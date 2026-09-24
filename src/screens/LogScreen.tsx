import { useEffect, useMemo, useRef, useState } from 'react'
import { useMember } from '../auth/authContext'
import { Keypad } from '../components/Keypad'
import { chip, input, primaryButton, quietButton, textarea } from '../components/styles'
import { deleteEntry, logEntry, uploadPhoto } from '../data/api'
import { useCatalog } from '../data/catalogContext'
import { pushRecentItem, recentItems } from '../lib/device'
import { errorMessage } from '../lib/errors'
import { euro, perBigUnit } from '../lib/format'
import { useT } from '../lib/i18n'
import { preparePhoto, type PreparedPhoto } from '../lib/imagePhoto'
import { matches } from '../lib/search'
import { REASONS, type Entry, type Item, type Reason } from '../types'

/**
 * The whole job, under 15 seconds, one thumb: pick the item (recent ones are
 * on top), type the amount on the big pad, tap why. The reason tap saves.
 */
export function LogScreen() {
  const { t } = useT()
  const { member } = useMember()
  const catalog = useCatalog()
  const [item, setItem] = useState<Item | null>(null)
  const [toast, setToast] = useState<Entry | null>(null)

  return (
    <div className="mx-auto w-full max-w-2xl page-x">
      {item ? (
        <EntryForm
          key={item.id}
          item={item}
          onCancel={() => setItem(null)}
          onSaved={(entry) => {
            pushRecentItem(member.user_id, item.id)
            setItem(null)
            setToast(entry)
          }}
        />
      ) : (
        <ItemPicker items={catalog.items} loading={catalog.loading} onPick={setItem} />
      )}
      {toast && <SavedToast key={toast.id} entry={toast} onDone={() => setToast(null)} />}
      {catalog.error && <p className="mt-4 text-danger">{catalog.error}</p>}
      {!item && !catalog.loading && catalog.items.length === 0 && (
        <p className="mt-6 text-ink-muted">{t('noItems')}</p>
      )}
    </div>
  )
}

function ItemPicker({
  items,
  loading,
  onPick,
}: {
  items: Item[]
  loading: boolean
  onPick: (i: Item) => void
}) {
  const { t } = useT()
  const { member } = useMember()
  const { stations } = useCatalog()
  const [term, setTerm] = useState('')
  const live = useMemo(() => items.filter((i) => !i.archived), [items])
  const recent = useMemo(() => {
    const byId = new Map(live.map((i) => [i.id, i]))
    return recentItems(member.user_id)
      .map((id) => byId.get(id))
      .filter((i): i is Item => !!i)
  }, [live, member.user_id])
  const shown = term ? live.filter((i) => matches(i.name, term)) : live
  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name

  return (
    <>
      <h1 className="text-h2 mt-8 mb-5">{t('logTitle')}</h1>
      <input
        type="search"
        className={input}
        placeholder={t('searchItem')}
        aria-label={t('searchItem')}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {!term && recent.length > 0 && (
        <section className="mt-6">
          <p className="eyebrow mb-3">{t('recent')}</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onPick(i)}
                className="min-h-14 rounded-full bg-accent-soft px-5 text-lg font-medium text-accent transition active:scale-[.98]"
              >
                {i.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        {!term && <p className="eyebrow mb-1">{t('allItems')}</p>}
        {loading && <p className="text-ink-muted">{t('loading')}</p>}
        {term && shown.length === 0 && <p className="mt-3 text-ink-muted">{t('noMatch')}</p>}
        <ul>
          {shown.map((i) => (
            <li key={i.id} className="border-b border-line">
              <button
                type="button"
                onClick={() => onPick(i)}
                className="flex min-h-16 w-full items-center justify-between gap-4 text-left text-lg"
              >
                <span>
                  {i.name}
                  {i.kind === 'prep' && (
                    <span className="ml-2 text-base text-ink-muted">· {t('componentBadge')}</span>
                  )}
                </span>
                <span className="shrink-0 text-base text-ink-muted">
                  {[stationName(i.station_id), t(`unit_${i.unit}`)].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function EntryForm({
  item,
  onCancel,
  onSaved,
}: {
  item: Item
  onCancel: () => void
  onSaved: (e: Entry) => void
}) {
  const { t, lang } = useT()
  const { restaurant } = useMember()
  const { stations } = useCatalog()
  // One id for the whole attempt, so a retry after a failed insert reuses the
  // photo already uploaded under it instead of leaving a second copy.
  const [id] = useState(() => crypto.randomUUID())
  const [qty, setQty] = useState('')
  const [cleaned, setCleaned] = useState(false)
  const [stationId, setStationId] = useState(item.station_id)
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [other, setOther] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const amount = Number(qty.replace(',', '.'))
  const unitCost = cleaned ? item.cleaned_unit_cost : item.unit_cost
  const estimate = amount > 0 && unitCost != null ? amount * unitCost : null

  function onKey(k: string) {
    setError(null)
    if (k === '⌫') return setQty((q) => q.slice(0, -1))
    if (k === ',' && (qty.includes(',') || qty === '')) return
    if (qty.length >= 7) return
    setQty((q) => (q === '0' && k !== ',' ? k : q + k))
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      const p = await preparePhoto(file)
      setPhoto(p)
      setPreview(URL.createObjectURL(p.full))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function save(reason: Reason) {
    if (!(amount > 0)) return setError(t('enterQty'))
    if (reason === 'other' && !note.trim()) {
      setOther(true)
      return setError(other ? t('noteRequired') : null)
    }
    setBusy(true)
    setError(null)
    try {
      const photoPath = photo ? await uploadPhoto(restaurant.id, id, photo) : null
      const entry = await logEntry({
        id,
        item_id: item.id,
        qty: amount,
        cleaned,
        reason,
        note: reason === 'other' ? note.trim() : null,
        station_id: stationId,
        photo_path: photoPath,
      })
      onSaved(entry)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="pt-6">
      <button type="button" className={`${quietButton} -ml-6`} onClick={onCancel}>
        ← {t('back')}
      </button>
      <h1 className="text-h2 mt-2 mb-1">{item.name}</h1>
      <p className="mb-4 text-ink-muted">
        {unitCost != null ? perBigUnit(unitCost, item.unit, lang) : t('incomplete')}
      </p>

      <p className="eyebrow mb-2">{t('howMuch')}</p>
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b-2 border-accent pb-2">
        <span className="num text-5xl font-medium" aria-live="polite">
          {qty || '0'}
          <span className="ml-2 text-2xl text-ink-muted">{t(`unit_${item.unit}`)}</span>
        </span>
        <span className="num text-xl text-highlight">
          {estimate != null ? `≈ ${euro(estimate, lang)}` : ''}
        </span>
      </div>
      <Keypad onKey={onKey} decimal={item.unit === 'pcs'} />

      {item.yield_pct != null && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className={chip(!cleaned)} onClick={() => setCleaned(false)}>
            {t('asBought')}
          </button>
          <button type="button" className={chip(cleaned)} onClick={() => setCleaned(true)}>
            {t('cleaned')}
          </button>
        </div>
      )}

      <p className="eyebrow mt-6 mb-2">{t('station')}</p>
      <div className="flex flex-wrap gap-2">
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            className={chip(stationId === s.id)}
            onClick={() => setStationId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        {preview ? (
          <>
            <img src={preview} alt="" className="size-20 object-cover" />
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                setPhoto(null)
                setPreview(null)
              }}
            >
              {t('removePhoto')}
            </button>
          </>
        ) : (
          <button type="button" className={chip(false)} onClick={() => fileRef.current?.click()}>
            {t('addPhoto')}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onPhoto(e.target.files?.[0])}
        />
      </div>

      <p className="eyebrow mt-8 mb-2">{t('why')}</p>
      {other && (
        <textarea
          className={`${textarea} mb-3`}
          rows={2}
          autoFocus
          placeholder={t('noteRequired')}
          aria-label={t('note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      <p role="alert" className="mb-2 min-h-6 text-danger">
        {error}
      </p>
      <div className="grid grid-cols-2 gap-2 pb-6">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy}
            onClick={() => void save(r)}
            className={`${r === 'other' && other ? primaryButton : chip(false)} min-h-16 text-left leading-tight`}
          >
            {t(`reason_${r}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** "Saved, €3,20 — Undo" for ten seconds. The Mijn lijst screen keeps undo for the full ten minutes. */
function SavedToast({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const { t, lang } = useT()
  const [state, setState] = useState<'saved' | 'undone' | 'expired'>('saved')
  // The parent re-renders (the catalog reloads on focus); the timer must not restart with it.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 10_000)
    return () => window.clearTimeout(id)
  }, [])

  async function undo() {
    try {
      setState((await deleteEntry(entry.id)) ? 'undone' : 'expired')
    } catch {
      setState('expired')
    }
  }

  return (
    <div className="rise fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 bg-deep px-5 py-3 text-on-deep">
        <span>
          {state === 'saved' && (
            <>
              {t('loggedToast', { name: entry.item_name })} ·{' '}
              <span className="num">
                {entry.cost != null ? euro(entry.cost, lang) : t('incomplete')}
              </span>
            </>
          )}
          {state === 'undone' && t('undone')}
          {state === 'expired' && t('undoExpired')}
        </span>
        {state === 'saved' && (
          <button
            type="button"
            onClick={() => void undo()}
            className="min-h-12 shrink-0 rounded-full border border-on-deep-muted px-4"
          >
            {t('undo')}
          </button>
        )}
      </div>
    </div>
  )
}
