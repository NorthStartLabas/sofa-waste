import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useMember } from '../auth/authContext'
import { ScreenTitle } from '../components/Shell'
import { column, input, primaryButton, quietButton, secondaryButton } from '../components/styles'
import { fetchReport, updateReportEmails } from '../data/api'
import { errorMessage } from '../lib/errors'
import { addDays, euro, isoDate, monday, number } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Report, ReportRow } from '../types'

/** The same numbers as Monday's email, for any week. */
export function Week() {
  const { t, lang } = useT()
  const { restaurant, isAdmin } = useMember()
  const [start, setStart] = useState(() => monday(new Date()))
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  }, [restaurant.id, weekStart])

  const dateLabel = start.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
  })
  const qty = (r: ReportRow) => `${number(r.qty, lang)} ${t(`unit_${r.unit}`)}`

  return (
    <div className={column}>
      <ScreenTitle eyebrow={t('weekOf', { date: dateLabel })} title={t('navWeek')} />
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setStart(addDays(start, -7))}
        >
          ← {t('prevWeek')}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={isCurrent}
          onClick={() => setStart(addDays(start, 7))}
        >
          {t('nextWeek')} →
        </button>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {!report && !error && <p className="text-ink-muted">{t('loading')}</p>}
      {report && (
        <>
          <p className="num font-display text-h1 text-highlight">{euro(report.total, lang)}</p>
          <p className="mt-1 text-lg">
            {report.total - report.prev_total >= 0 ? '+' : '−'}
            {euro(Math.abs(report.total - report.prev_total), lang)}{' '}
            {t('vsLastWeek', { prev: euro(report.prev_total, lang) })}
          </p>
          <p className="mt-1 text-ink-muted">
            {report.entries} {t('entries')}
            {report.per_cover != null &&
              ` · ${euro(report.per_cover, lang)} ${t('perCover')} (${report.covers} ${t('covers').toLowerCase()})`}
          </p>
          <Link to="/covers" className={`${quietButton} -ml-6`}>
            {t('covers')} →
          </Link>

          {report.repeated.length > 0 && (
            <Block title={t('repeated')} help={t('repeatedHelp')}>
              {report.repeated.map((r) => (
                <Line
                  key={r.name}
                  label={r.name}
                  middle={`${t('days', { n: r.days })} · ${qty(r)}`}
                  value={euro(r.total, lang)}
                />
              ))}
            </Block>
          )}

          <Block title={t('topItems')}>
            {report.top_items.map((r) => (
              <Line key={r.name} label={r.name} middle={qty(r)} value={euro(r.total, lang)} />
            ))}
          </Block>

          <Block title={t('byReason')}>
            {report.by_reason.map((r) => (
              <Line
                key={r.reason}
                label={t(`reason_${r.reason}`)}
                middle={`${r.entries}×`}
                value={euro(r.total, lang)}
              />
            ))}
          </Block>

          <Block title={t('byStation')}>
            {report.by_station.map((r) => (
              <Line
                key={r.station}
                label={r.station}
                middle={`${r.entries}×`}
                value={euro(r.total, lang)}
              />
            ))}
          </Block>

          {report.incomplete.length > 0 && (
            <Block title={t('incompleteCosts')} help={t('incompleteHelp')}>
              {report.incomplete.map((r) => (
                <Line key={r.name} label={r.name} middle="" value={`${r.entries}×`} />
              ))}
            </Block>
          )}
        </>
      )}

      {isAdmin && <Recipients initial={restaurant.report_emails} restaurantId={restaurant.id} />}
    </div>
  )
}

function Block({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-h3">{title}</h2>
      {help && <p className="text-ink-muted">{help}</p>}
      <ul className="mt-2">{children}</ul>
    </section>
  )
}

function Line({ label, middle, value }: { label: string; middle: string; value: string }) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-line py-2">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="num shrink-0 text-ink-muted">{middle}</span>
      <span className="num w-24 shrink-0 text-right text-highlight">{value}</span>
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
    <section className="mt-12 border-t border-line pt-6">
      <label className="flex flex-col gap-2">
        <span className="text-h3 font-display">{t('recipients')}</span>
        <span className="text-ink-muted">{t('recipientsHelp')}</span>
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
        <span className="text-ink-muted">{state}</span>
      </div>
    </section>
  )
}
