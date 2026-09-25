import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  NotebookIcon,
  SlidersHorizontalIcon,
} from '@phosphor-icons/react'
import { useMember } from '../auth/authContext'
import { EntryRow } from '../components/EntryRow'
import { Sheet } from '../components/Sheet'
import { PageHeader } from '../components/Shell'
import { Empty, ErrorLine, SkeletonRows } from '../components/States'
import {
  chip,
  dangerButton,
  input,
  label,
  money,
  primaryButton,
  secondaryButton,
  select,
  textarea,
  wide,
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
import { addDays, day, euro, isoDate, monday, number, perBigUnit, time } from '../lib/format'
import { groupByDay } from '../lib/groupByDay'
import { useT } from '../lib/i18n'
import { matches } from '../lib/search'
import { REASONS, type Entry, type Member, type Reason } from '../types'

/**
 * Every entry in the restaurant, filterable, editable by chefs, exportable.
 * Phone: rows grouped by day. Desktop: one table, filters in a bar above it.
 */
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
  const [filtersOpen, setFiltersOpen] = useState(false)

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
  const activeFilters = [reason, stationId, cook, term].filter(Boolean).length
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
      t('date'),
      t('time'),
      t('item'),
      t('quantity'),
      t('unit'),
      t('cleaned'),
      t('reason'),
      t('note'),
      t('station'),
      t('cook'),
      t('costPerUnit'),
      t('cost'),
    ]
    download(`verspilling-${from}-${to}.csv`, toCsv([header, ...rows]))
  }

  return (
    <div className={wide}>
      <PageHeader
        title={t('navOverview')}
        meta={
          entries && (
            <>
              {shown.length} {t('entries')}{' '}
              <span className={`${money} ml-2`}>{euro(total, lang)}</span>
            </>
          )
        }
      >
        <button
          type="button"
          className={secondaryButton}
          onClick={exportCsv}
          disabled={!shown.length}
        >
          <DownloadSimpleIcon size={20} aria-hidden />
          {t('exportCsv')}
        </button>
      </PageHeader>

      {/* Phone: the filters fold away behind one button, so the list starts on the first screen. */}
      <button
        type="button"
        aria-expanded={filtersOpen}
        className={`${secondaryButton} mb-4 lg:hidden`}
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <SlidersHorizontalIcon size={20} aria-hidden />
        {t('filters')}
        {activeFilters > 0 && <span className="num text-accent">({activeFilters})</span>}
      </button>
      <div
        className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-3 lg:grid lg:grid-cols-[10rem_10rem_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)] lg:items-end`}
      >
        <label className="flex flex-col gap-2">
          <span className={label}>{t('from')}</span>
          <input
            type="date"
            className={input}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>{t('to')}</span>
          <input
            type="date"
            className={input}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>{t('reason')}</span>
          <select className={select} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t('all')}</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reason_${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>{t('station')}</span>
          <select
            className={select}
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">{t('all')}</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className={label}>{t('cook')}</span>
          <select className={select} value={cook} onChange={(e) => setCook(e.target.value)}>
            <option value="">{t('all')}</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="relative col-span-2 flex flex-col gap-2 lg:col-span-1">
          <span className={label}>{t('item')}</span>
          <span className="relative">
            <MagnifyingGlassIcon
              size={20}
              className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              type="search"
              className={`${input} pl-12`}
              placeholder={t('search')}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </span>
        </label>
      </div>

      <div className="mt-8">
        {error && <ErrorLine message={error} onRetry={() => void load()} />}
        {entries?.length === ENTRY_LIMIT && (
          <p className="mb-4 text-ink-muted">{t('showingMax', { n: ENTRY_LIMIT })}</p>
        )}
        {entries === null && !error && <SkeletonRows rows={8} tall />}
        {entries && shown.length === 0 && (
          <Empty icon={NotebookIcon} title={t('nothingFound')}>
            <p className="text-ink-muted">{t('nothingFoundHelp')}</p>
          </Empty>
        )}

        {shown.length > 0 && (
          <>
            {/* Phone: rows grouped by day. */}
            <div className="lg:hidden">
              {groupByDay(shown).map(([key, rows]) => (
                <section key={key} className="mb-6">
                  <h2 className="eyebrow mb-1">{day(rows[0].logged_at, lang)}</h2>
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
            </div>

            {/* Desktop: one table. */}
            <table className="hidden w-full border-collapse text-left lg:table">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line-strong text-ink-muted">
                  <th className="py-3 pr-4 font-medium">{t('when')}</th>
                  <th className="py-3 pr-4 font-medium">{t('item')}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t('quantity')}</th>
                  <th className="py-3 pr-4 font-medium">{t('reason')}</th>
                  <th className="py-3 pr-4 font-medium">{t('station')}</th>
                  <th className="py-3 pr-4 font-medium">{t('cook')}</th>
                  <th className="py-3 text-right font-medium">{t('cost')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const thumb = e.photo_path ? thumbs.get(e.photo_path) : undefined
                  return (
                    <tr
                      key={e.id}
                      tabIndex={0}
                      onClick={() => setOpen(e)}
                      onKeyDown={(k) => k.key === 'Enter' && setOpen(e)}
                      className="cursor-pointer border-b border-line transition-colors hover:bg-paper-raised focus-visible:bg-paper-raised"
                    >
                      <td className="num py-3 pr-4 whitespace-nowrap text-ink-muted">
                        {day(e.logged_at, lang)} {time(e.logged_at, lang)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-3">
                          {thumb && (
                            <img
                              src={thumb}
                              alt=""
                              className="size-9 object-cover"
                              loading="lazy"
                            />
                          )}
                          <span>
                            {e.item_name}
                            {e.note && <span className="block text-ink-muted">{e.note}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="num py-3 pr-4 text-right whitespace-nowrap">
                        {number(e.qty, lang, 2)} {t(`unit_${e.unit}`)}
                        {e.cleaned && (
                          <span className="block text-ink-muted">{t('cleaned').toLowerCase()}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">{t(`reason_${e.reason}`)}</td>
                      <td className="py-3 pr-4 text-ink-muted">{stationName(e.station_id)}</td>
                      <td className="py-3 pr-4 text-ink-muted">{e.logged_by_name}</td>
                      <td className="num py-3 text-right whitespace-nowrap">
                        {e.cost != null ? (
                          <span className="text-highlight">{euro(e.cost, lang)}</span>
                        ) : (
                          <span className="text-ink-muted">{t('incomplete')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

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
    <Sheet title={entry.item_name} onClose={onClose}>
      <p className="mb-5 text-ink-muted">
        {day(entry.logged_at, lang)} {time(entry.logged_at, lang)}, {entry.logged_by_name}
        {entry.unit_cost != null && `. ${perBigUnit(entry.unit_cost, entry.unit, lang)}`}
      </p>
      {photo && <img src={photo} alt="" className="mb-5 max-h-[45vh] w-full object-contain" />}

      <label className="mb-5 flex flex-col gap-2">
        <span className={label}>
          {t('quantity')} ({t(`unit_${entry.unit}`)})
        </span>
        <input
          className={`${input} num`}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>

      <p className={`${label} mb-2`}>{t('reason')}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" className={chip(reason === r)} onClick={() => setReason(r)}>
            {t(`reason_${r}`)}
          </button>
        ))}
      </div>
      <textarea
        className={`${textarea} mb-5`}
        rows={2}
        placeholder={t('note')}
        aria-label={t('note')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <p className={`${label} mb-2`}>{t('station')}</p>
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

      {error && (
        <div className="mb-4">
          <ErrorLine message={error} />
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2">
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
