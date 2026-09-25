import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretLeftIcon,
  CaretRightIcon,
  ForkKnifeIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useAuth, useMember } from '../auth/authContext'
import { PageHeader } from '../components/Shell'
import { ErrorLine, SkeletonRows } from '../components/States'
import { help, input, label, money, primaryButton, quietButton, wide } from '../components/styles'
import { fetchReport, updateReportEmails } from '../data/api'
import { errorMessage } from '../lib/errors'
import { addDays, euro, isoDate, monday, number } from '../lib/format'
import { useT } from '../lib/i18n'
import { REASON_ICON } from '../lib/reasonIcons'
import type { Report, ReportRow } from '../types'

/** The same numbers as Monday's email, for any week. */
export function Week() {
  const { t, lang } = useT()
  const { restaurant, isAdmin } = useMember()
  const [start, setStart] = useState(() => monday(new Date()))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const weekStart = isoDate(start)
  const isCurrent = weekStart === isoDate(monday(new Date()))

  useEffect(() => {
    let live = true
    setReport(null)
    fetchReport(restaurant.id, weekStart).then(
      (r) => live && (setReport(r), setError(null)),
      (e) => live && setError(errorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [restaurant.id, weekStart, tick])

  const loc = lang === 'nl' ? 'nl-NL' : 'en-GB'
  const range = `${start.toLocaleDateString(loc, { day: 'numeric', month: 'long' })} - ${addDays(start, 6).toLocaleDateString(loc, { day: 'numeric', month: 'long' })}`
  const qty = (r: ReportRow) => `${number(r.qty, lang)} ${t(`unit_${r.unit}`)}`
  const diff = report ? report.total - report.prev_total : 0

  return (
    <div className={wide}>
      <PageHeader title={t('navWeek')} meta={range}>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t('prevWeek')}
            title={t('prevWeek')}
            className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-paper-raised transition hover:border-accent active:scale-[.98]"
            onClick={() => setStart(addDays(start, -7))}
          >
            <CaretLeftIcon size={20} />
          </button>
          <button
            type="button"
            aria-label={t('nextWeek')}
            title={t('nextWeek')}
            disabled={isCurrent}
            className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-paper-raised transition hover:border-accent active:scale-[.98] disabled:opacity-40"
            onClick={() => setStart(addDays(start, 7))}
          >
            <CaretRightIcon size={20} />
          </button>
        </div>
      </PageHeader>

      {error && <ErrorLine message={error} onRetry={() => setTick((n) => n + 1)} />}
      {!report && !error && <SkeletonRows rows={6} tall />}

      {report && (
        <>
          {/* The week in four numbers. */}
          <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <Stat className="col-span-2 lg:col-span-1" label={t('total')}>
              <span className={`${money} font-display text-h1`}>{euro(report.total, lang)}</span>
            </Stat>
            <Stat label={t('vsLastWeekShort')}>
              <span className={`num text-h3 ${diff > 0 ? 'text-highlight' : 'text-accent'}`}>
                {diff > 0 ? '+' : diff < 0 ? '-' : ''}
                {euro(Math.abs(diff), lang)}
              </span>
              <span className="text-ink-muted">
                {t('lastWeekWas', { prev: euro(report.prev_total, lang) })}
              </span>
            </Stat>
            <Stat label={t('perCoverLabel')}>
              {report.per_cover != null ? (
                <>
                  <span className="num text-h3">{euro(report.per_cover, lang)}</span>
                  <span className="text-ink-muted">
                    {number(report.covers, lang)} {t('covers').toLowerCase()}
                  </span>
                </>
              ) : (
                <Link to="/covers" className={`${quietButton} min-h-0 justify-start`}>
                  <ForkKnifeIcon size={18} aria-hidden />
                  {t('enterCovers')}
                </Link>
              )}
            </Stat>
            <Stat className="col-span-2 lg:col-span-1" label={t('entriesLabel')}>
              <span className="num text-h3">{report.entries}</span>
              {report.incomplete_entries > 0 && (
                <span className="text-ink-muted">
                  {t('nIncomplete', { n: report.incomplete_entries })}
                </span>
              )}
            </Stat>
          </div>

          {report.repeated.length > 0 && (
            <section className="mt-10 border-l-2 border-highlight bg-paper-raised px-5 py-5 lg:px-8">
              <h2 className="text-h3">{t('repeated')}</h2>
              <p className="text-ink-muted">{t('repeatedHelp')}</p>
              <ul className="mt-3">
                {report.repeated.map((r) => (
                  <li
                    key={r.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                  >
                    <span className="text-lg">{r.name}</span>
                    <span className="num text-ink-muted">
                      {t('days', { n: r.days })}, {qty(r)}
                      <span className={`${money} ml-4`}>{euro(r.total, lang)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.entries === 0 ? (
            <p className="mt-10 text-ink-muted">{t('weekEmpty')}</p>
          ) : (
            <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
              <Block className="lg:col-span-7" title={t('topItems')}>
                {report.top_items.map((r) => (
                  <Bar
                    key={r.name}
                    name={r.name}
                    detail={qty(r)}
                    value={r.total}
                    max={report.top_items[0]?.total}
                  />
                ))}
              </Block>
              <div className="flex flex-col gap-10 lg:col-span-5">
                <Block title={t('byReason')}>
                  {report.by_reason.map((r) => {
                    const I = REASON_ICON[r.reason]
                    return (
                      <Bar
                        key={r.reason}
                        name={
                          <span className="flex items-center gap-2">
                            <I size={18} className="text-accent" aria-hidden />
                            {t(`reason_${r.reason}`)}
                          </span>
                        }
                        detail={`${r.entries}x`}
                        value={r.total}
                        max={report.by_reason[0]?.total}
                      />
                    )
                  })}
                </Block>
                <Block title={t('byStation')}>
                  {report.by_station.map((r) => (
                    <Bar
                      key={r.station ?? 'none'}
                      name={r.station ?? t('noStation')}
                      detail={`${r.entries}x`}
                      value={r.total}
                      max={report.by_station[0]?.total}
                    />
                  ))}
                </Block>
              </div>
            </div>
          )}

          {report.incomplete.length > 0 && (
            <section className="mt-10 flex gap-4 border border-line bg-paper-raised p-5">
              <WarningCircleIcon size={24} className="shrink-0 text-danger" aria-hidden />
              <div>
                <h2 className="font-sans font-medium">{t('incompleteCosts')}</h2>
                <p className="text-ink-muted">{t('incompleteHelp')}</p>
                <p className="mt-2">
                  {report.incomplete.map((r) => `${r.name} (${r.entries}x)`).join(', ')}
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {isAdmin && <Recipients initial={restaurant.report_emails} restaurantId={restaurant.id} />}
    </div>
  )
}

function Stat({
  label: l,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`flex flex-col justify-end gap-1 bg-paper-raised p-5 lg:p-6 ${className}`}>
      <span className="text-ink-muted">{l}</span>
      {children}
    </div>
  )
}

function Block({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 text-h3">{title}</h2>
      <ul>{children}</ul>
    </section>
  )
}

/** A row with a moss bar under it, as long as its share of the biggest. No track behind it. */
function Bar({
  name,
  detail,
  value,
  max,
}: {
  name: ReactNode
  detail: string
  value: number | null
  max: number | null | undefined
}) {
  const { lang } = useT()
  const share = value != null && max ? Math.max(0.02, value / max) : 0
  return (
    <li className="py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1">{name}</span>
        <span className="num shrink-0 text-ink-muted">{detail}</span>
        <span className={`${money} w-24 shrink-0 text-right`}>{euro(value, lang)}</span>
      </div>
      <div
        className="mt-1.5 h-1 origin-left bg-accent/70"
        style={{ transform: `scaleX(${share})` }}
      />
    </li>
  )
}

function Recipients({ initial, restaurantId }: { initial: string[]; restaurantId: string }) {
  const { t } = useT()
  const { reload } = useAuth()
  const [value, setValue] = useState(initial.join(', '))
  const [state, setState] = useState<string | null>(null)

  async function save() {
    const emails = value
      .split(/[,\s;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    try {
      await updateReportEmails(restaurantId, emails)
      setState(t('saved'))
      reload()
    } catch (e) {
      setState(errorMessage(e))
    }
  }

  return (
    <section className="mt-16 max-w-2xl border-t border-line pt-8">
      <label className="flex flex-col gap-2">
        <span className={`${label} font-display text-h3 font-medium`}>{t('recipients')}</span>
        <span className={help}>{t('recipientsHelp')}</span>
        <input
          className={input}
          type="text"
          inputMode="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="mt-3 flex items-center gap-4">
        <button type="button" className={primaryButton} onClick={() => void save()}>
          {t('save')}
        </button>
        <span className="text-ink-muted" role="status">
          {state}
        </span>
      </div>
    </section>
  )
}
