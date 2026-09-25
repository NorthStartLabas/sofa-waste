import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  BooksIcon,
  CameraPlusIcon,
  MagnifyingGlassIcon,
  ScalesIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useMember } from '../auth/authContext'
import { Keypad } from '../components/Keypad'
import { Empty, ErrorLine, SkeletonRows } from '../components/States'
import {
  chip,
  input,
  panel,
  primaryButton,
  quietButton,
  textarea,
  wide,
} from '../components/styles'
import { deleteEntry, logEntry, uploadPhoto } from '../data/api'
import { useCatalog } from '../data/catalogContext'
import { pushRecentItem, recentItems } from '../lib/device'
import { errorMessage } from '../lib/errors'
import { euro, perBigUnit } from '../lib/format'
import { useT } from '../lib/i18n'
import { preparePhoto, type PreparedPhoto } from '../lib/imagePhoto'
import { REASON_ICON } from '../lib/reasonIcons'
import { matches } from '../lib/search'
import { REASONS, type Entry, type Item, type Reason } from '../types'

/**
 * The whole job, under 15 seconds, one thumb: pick the item (recent ones
 * first), type the amount on the big pad, tap why. The reason tap saves.
 *
 * Phone: one step at a time, the picker gives way to the form. Desktop: both
 * at once, the picker on the left and the form in a panel on the right.
 */
export function LogScreen() {
  const { t } = useT()
  const { member } = useMember()
  const catalog = useCatalog()
  const [item, setItem] = useState<Item | null>(null)
  const [toast, setToast] = useState<Entry | null>(null)

  return (
    <div className={wide}>
      <div className="lg:mt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-start lg:gap-12">
        <section className={item ? 'hidden lg:block' : ''}>
          <ItemPicker selected={item} onPick={setItem} />
        </section>
        <section
          className={`lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto ${item ? '' : 'hidden lg:block'}`}
        >
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
            catalog.items.length > 0 && (
              <div className={`${panel} flex flex-col items-center gap-3 px-8 py-16 text-center`}>
                <ScalesIcon size={36} className="text-accent" aria-hidden />
                <p className="font-display text-h3">{t('pickFirst')}</p>
                <p className="text-ink-muted">{t('pickFirstHelp')}</p>
              </div>
            )
          )}
        </section>
      </div>
      {toast && <SavedToast key={toast.id} entry={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function ItemPicker({ selected, onPick }: { selected: Item | null; onPick: (i: Item) => void }) {
  const { t } = useT()
  const { member, isChef } = useMember()
  const { items, stations, loading, error, reload } = useCatalog()
  const [term, setTerm] = useState('')
  const live = useMemo(() => items.filter((i) => !i.archived), [items])
  const recent = useMemo(() => {
    const byId = new Map(live.map((i) => [i.id, i]))
    return recentItems(member.user_id)
      .map((id) => byId.get(id))
      .filter((i): i is Item => !!i)
  }, [live, member.user_id])

  // Grouped by station in the kitchen's own order, so a cook scanning for
  // "crème" looks under entremetier, not through the alphabet.
  const groups = useMemo(() => {
    const shown = term ? live.filter((i) => matches(i.name, term)) : live
    const out = stations
      .map((s) => ({ key: s.id, name: s.name, items: shown.filter((i) => i.station_id === s.id) }))
      .filter((g) => g.items.length)
    const rest = shown.filter((i) => !stations.some((s) => s.id === i.station_id))
    if (rest.length) out.push({ key: 'none', name: t('noStation'), items: rest })
    return out
  }, [live, stations, term, t])

  return (
    <>
      <h1 className="text-h2 mt-6 mb-4 lg:mt-0">{t('logTitle')}</h1>
      <div className="sticky top-0 z-20 -mx-[var(--spacing-gutter)] bg-paper px-[var(--spacing-gutter)] py-2 lg:static lg:mx-0 lg:px-0">
        <label className="relative block">
          <MagnifyingGlassIcon
            size={20}
            className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            className={`${input} pl-12`}
            placeholder={t('searchItem')}
            aria-label={t('searchItem')}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorLine message={error} onRetry={() => void reload()} />
        </div>
      )}

      {!term && recent.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 font-medium text-ink-muted">{t('recent')}</h2>
          <div className="-mx-[var(--spacing-gutter)] flex snap-x gap-2 overflow-x-auto px-[var(--spacing-gutter)] pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {recent.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onPick(i)}
                className="min-h-14 shrink-0 snap-start rounded-full bg-accent-soft px-5 text-lg font-medium whitespace-nowrap text-accent transition active:scale-[.98]"
              >
                {i.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <SkeletonRows rows={8} />}
      {!loading && live.length === 0 && (
        <div className="mt-6">
          <Empty icon={BooksIcon} title={t('noItemsTitle')}>
            <p className="text-ink-muted">{isChef ? t('noItemsChef') : t('noItemsCook')}</p>
            {isChef && (
              <Link to="/catalog/new/raw" className={primaryButton}>
                {t('newProduct')}
              </Link>
            )}
          </Empty>
        </div>
      )}
      {term && groups.length === 0 && <p className="mt-6 text-ink-muted">{t('noMatch')}</p>}

      {groups.map((g) => (
        <section key={g.key} className="mt-6">
          <h2 className="eyebrow mb-1">{g.name}</h2>
          <ul>
            {g.items.map((i) => {
              const active = selected?.id === i.id
              return (
                <li key={i.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPick(i)}
                    className={`flex min-h-16 w-full items-center justify-between gap-4 text-left text-lg transition-colors lg:-mx-4 lg:w-[calc(100%+2rem)] lg:px-4 ${
                      active ? 'lg:bg-accent-soft' : 'lg:hover:bg-paper-sunk/60'
                    }`}
                  >
                    <span className="min-w-0">
                      {i.name}
                      {i.kind === 'prep' && (
                        <span className="ml-2 text-base whitespace-nowrap text-ink-muted">
                          {t('componentBadge')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-base text-ink-muted">{t(`unit_${i.unit}`)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
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
  const decimal = item.unit === 'pcs'

  function onKey(k: string) {
    setError(null)
    if (k === 'back') return setQty((q) => q.slice(0, -1))
    if (k === ',' && (!decimal || qty.includes(',') || qty === '')) return
    if (qty.length >= 7) return
    setQty((q) => (q === '0' && k !== ',' ? k : q + k))
  }

  // On a desktop the number keys type the amount too. Not while a field has focus.
  const keyRef = useRef(onKey)
  useEffect(() => {
    keyRef.current = onKey
  })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (/^[0-9]$/.test(e.key)) keyRef.current(e.key)
      else if (e.key === ',' || e.key === '.') keyRef.current(',')
      else if (e.key === 'Backspace') keyRef.current('back')
      else if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

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
    <div className="rise pt-4 lg:border lg:border-line lg:bg-paper-raised lg:p-6">
      <button type="button" className={`${quietButton} mb-2 lg:hidden`} onClick={onCancel}>
        <ArrowLeftIcon size={20} aria-hidden />
        {t('back')}
      </button>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-h2 lg:text-h3">{item.name}</h2>
          <p className="text-ink-muted">
            {unitCost != null ? perBigUnit(unitCost, item.unit, lang) : t('costIncomplete')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('close')}
          onClick={onCancel}
          className="hidden size-12 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-paper-sunk lg:flex"
        >
          <XIcon size={22} />
        </button>
      </div>

      <div className="mt-5 mb-3 flex items-end justify-between gap-4 border-b-2 border-accent pb-2">
        <span className="num text-6xl leading-none font-medium lg:text-5xl" aria-live="polite">
          {qty || '0'}
          <span className="ml-2 text-2xl text-ink-muted">{t(`unit_${item.unit}`)}</span>
        </span>
        <span className="num text-xl text-highlight">
          {estimate != null ? `≈ ${euro(estimate, lang)}` : ''}
        </span>
      </div>

      {item.yield_pct != null && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" className={chip(!cleaned)} onClick={() => setCleaned(false)}>
            {t('asBought')}
          </button>
          <button type="button" className={chip(cleaned)} onClick={() => setCleaned(true)}>
            {t('cleaned')}
          </button>
        </div>
      )}

      <Keypad onKey={onKey} decimal={decimal} />

      <div className="-mx-[var(--spacing-gutter)] mt-5 flex gap-2 overflow-x-auto px-[var(--spacing-gutter)] pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${chip(stationId === s.id)} shrink-0`}
            onClick={() => setStationId(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        {preview ? (
          <>
            <img src={preview} alt="" className="size-16 object-cover" />
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
            <CameraPlusIcon size={20} aria-hidden />
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

      <h3 className="mt-6 mb-2 font-medium">{t('why')}</h3>
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
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 pb-6 lg:pb-0">
        {REASONS.map((r) => {
          const I = REASON_ICON[r]
          const on = r === 'other' && other
          return (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => void save(r)}
              className={`flex min-h-16 items-center gap-3 rounded-full px-5 text-left leading-tight font-medium transition active:scale-[.98] disabled:opacity-45 ${
                on
                  ? 'bg-accent text-accent-contrast'
                  : 'border border-line-strong bg-paper-raised text-ink hover:border-accent'
              } ${r === 'other' ? 'col-span-2' : ''}`}
            >
              <I size={22} className={`shrink-0 ${on ? '' : 'text-accent'}`} aria-hidden />
              {t(`reason_${r}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** "Saved, €3,20. Undo" for ten seconds; the bar underneath drains with the time. */
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
    <div
      role="status"
      className="rise fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 px-4 lg:inset-x-auto lg:right-8 lg:bottom-8 lg:w-[26rem] lg:px-0"
    >
      <div className="mx-auto max-w-2xl overflow-hidden bg-deep text-on-deep shadow-[0_12px_32px_rgb(43_53_41/0.28)]">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <span>
            {state === 'saved' && (
              <>
                {t('loggedToast', { name: entry.item_name })}{' '}
                <span className="num">
                  {entry.cost != null ? euro(entry.cost, lang) : t('costIncomplete')}
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
              className="min-h-12 shrink-0 rounded-full border border-on-deep/30 px-4 transition active:scale-[.98]"
            >
              {t('undo')}
            </button>
          )}
        </div>
        <div className="drain h-1 origin-left bg-on-deep-muted" />
      </div>
    </div>
  )
}
