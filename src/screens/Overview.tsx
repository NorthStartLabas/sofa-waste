import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMember } from '../auth/authContext'
import { EntryRow } from '../components/EntryRow'
import { groupByDay } from '../lib/groupByDay'
import { Sheet } from '../components/Sheet'
import { ScreenTitle } from '../components/Shell'
import {
  chip,
  column,
  dangerButton,
  input,
  primaryButton,
  secondaryButton,
  select,
  textarea,
} from '../components/styles'
import {
  deleteEntry,
  ENTRY_LIMIT,
  fetchEntries,
  fetchMembers,
  photoUrls,
  updateEntry,
} from '../data/api'
import { useCatalog } from '../data/catalogContext'
import { download, toCsv } from '../lib/csv'
import { errorMessage } from '../lib/errors'
import { addDays, day, euro, isoDate, monday, time } from '../lib/format'
import { useT } from '../lib/i18n'
import { matches } from '../lib/search'
import { REASONS, type Entry, type Member, type Reason } from '../types'

/** Every entry in the restaurant, filterable, editable by chefs, exportable. */
export function Overview() {
  const { t, lang } = useT()
  const { restaurant } = useMember()
  const { stations } = useCatalog()
  const [from, setFrom] = useState(() => isoDate(monday(new Date())))
  const [to, setTo] = useState(() => isoDate(new Date()))
  const [reason, setReason] = useState('')
  const [stationId, setStationId] = useState('')
  const [cook, setCook] = useState('')
  const [term, setTerm] = useState('')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [thumbs, setThumbs] = useState(new Map<string, string>())
  const [members, setMembers] = useState<Member[]>([])
  const [open, setOpen] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await fetchEntries(restaurant.id, {
        // Local midnight to local midnight, inclusive of the "to" day.
        from: new Date(`${from}T00:00`),
        to: addDays(new Date(`${to}T00:00`), 1),
        reason: reason || undefined,
        stationId: stationId || undefined,
        cook: cook || undefined,
      })
      setEntries(rows)
      setError(null)
      const folders = rows.flatMap((r) => (r.photo_path ? [r.photo_path] : []))
      setThumbs(await photoUrls(folders, 'thumb'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [restaurant.id, from, to, reason, stationId, cook])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    fetchMembers(restaurant.id).then(setMembers, () => {})
  }, [restaurant.id])

  const shown = useMemo(
    () => (entries ?? []).filter((e) => !term || matches(e.item_name, term)),
    [entries, term],
  )
  const total = shown.reduce((s, e) => s + (e.cost ?? 0), 0)
  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name ?? ''

  function exportCsv() {
    const rows = shown.map((e) => [
      isoDate(new Date(e.logged_at)),
      time(e.logged_at, lang),
      e.item_name,
      e.qty,
      t(`unit_${e.unit}`),
      e.cleaned ? t('cleaned') : '',
      t(`reason_${e.reason}`),
      e.note,
      stationName(e.station_id),
      e.logged_by_name,
      e.unit_cost,
      e.cost,
    ])
    const header = [
      'datum',
      'tijd',
      t('item'),
      t('quantity'),
      t('unit'),
      t('cleaned'),
      t('reason'),
      t('note'),
      t('station'),
      t('cook'),
      `${t('costPerUnit')} (€/${t('unit').toLowerCase()})`,
      '€',
    ]
    download(`verspilling-${from}-${to}.csv`, toCsv([header, ...rows]))
  }

  return (
    <div className={column}>
      <ScreenTitle eyebrow={`${shown.length} ${t('entries')}`} title={t('navOverview')}>
        <span className="num text-h3 text-highlight">{euro(total, lang)}</span>
      </ScreenTitle>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t('from')}</span>
          <input
            type="date"
            className={input}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t('to')}</span>
          <input
            type="date"
            className={input}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <select
          className={select}
          aria-label={t('reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="">
            {t('reason')}: {t('all').toLowerCase()}
          </option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reason_${r}`)}
            </option>
          ))}
        </select>
        <select
          className={select}
          aria-label={t('station')}
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
        >
          <option value="">
            {t('station')}: {t('all').toLowerCase()}
          </option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={select}
          aria-label={t('cook')}
          value={cook}
          onChange={(e) => setCook(e.target.value)}
        >
          <option value="">
            {t('cook')}: {t('all').toLowerCase()}
          </option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          className={input}
          placeholder={t('search')}
          aria-label={t('search')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      <button
        type="button"
        className={`${secondaryButton} mt-3 w-full`}
        onClick={exportCsv}
        disabled={!shown.length}
      >
        {t('exportCsv')}
      </button>

      {error && <p className="mt-4 text-danger">{error}</p>}
      {entries?.length === ENTRY_LIMIT && (
        <p className="mt-4 text-ink-muted">{t('showingMax', { n: ENTRY_LIMIT })}</p>
      )}
      {entries === null && !error && <p className="mt-6 text-ink-muted">{t('loading')}</p>}
      {entries && shown.length === 0 && <p className="mt-6 text-ink-muted">{t('nothingYet')}</p>}

      {groupByDay(shown).map(([key, rows]) => (
        <section key={key} className="mt-6">
          <p className="eyebrow mb-1">{day(rows[0].logged_at, lang)}</p>
          <ul>
            {rows.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                showCook
                stationName={stationName(e.station_id)}
                thumb={e.photo_path ? thumbs.get(e.photo_path) : undefined}
                onOpen={() => setOpen(e)}
              />
            ))}
          </ul>
        </section>
      ))}

      {open && (
        <EditEntry
          entry={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function EditEntry({
  entry,
  onClose,
  onChanged,
}: {
  entry: Entry
  onClose: () => void
  onChanged: () => void
}) {
  const { t, lang } = useT()
  const { stations } = useCatalog()
  const [qty, setQty] = useState(String(entry.qty).replace('.', ','))
  const [reason, setReason] = useState<Reason>(entry.reason)
  const [note, setNote] = useState(entry.note ?? '')
  const [stationId, setStationId] = useState(entry.station_id)
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry.photo_path) {
      photoUrls([entry.photo_path], 'full').then(
        (m) => setPhoto(m.get(entry.photo_path!) ?? null),
        () => {},
      )
    }
  }, [entry.photo_path])

  async function run(work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const amount = Number(qty.replace(',', '.'))
  const valid = amount > 0 && (reason !== 'other' || note.trim())

  return (
    <Sheet title={t('editEntry')} onClose={onClose}>
      <p className="text-lg">{entry.item_name}</p>
      <p className="mb-4 text-ink-muted">
        {day(entry.logged_at, lang)} {time(entry.logged_at, lang)} · {entry.logged_by_name}
        {entry.unit_cost != null &&
          ` · ${euro(entry.unit_cost, lang, 4)} / ${t(`unit_${entry.unit}`)}`}
      </p>
      {photo && <img src={photo} alt="" className="mb-4 max-h-[50vh] w-full object-contain" />}

      <label className="mb-4 flex flex-col gap-1">
        <span className="eyebrow">
          {t('quantity')} ({t(`unit_${entry.unit}`)})
        </span>
        <input
          className={`${input} num`}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>

      <p className="eyebrow mb-2">{t('reason')}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" className={chip(reason === r)} onClick={() => setReason(r)}>
            {t(`reason_${r}`)}
          </button>
        ))}
      </div>
      <textarea
        className={`${textarea} mb-4`}
        rows={2}
        placeholder={t('note')}
        aria-label={t('note')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <p className="eyebrow mb-2">{t('station')}</p>
      <div className="mb-6 flex flex-wrap gap-2">
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

      {error && <p className="mb-4 text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={busy || !valid}
          onClick={() =>
            void run(() =>
              updateEntry(entry.id, {
                qty: amount,
                reason,
                note: note.trim() || null,
                station_id: stationId,
              }),
            )
          }
        >
          {t('save')}
        </button>
        <button
          type="button"
          className={dangerButton}
          disabled={busy}
          onClick={() =>
            window.confirm(t('confirmDelete')) && void run(() => deleteEntry(entry.id))
          }
        >
          {t('delete')}
        </button>
      </div>
    </Sheet>
  )
}
