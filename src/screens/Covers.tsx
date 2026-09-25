import { useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { PageHeader } from '../components/Shell'
import { ErrorLine } from '../components/States'
import { input, wide } from '../components/styles'
import { fetchCovers, saveCovers } from '../data/api'
import { errorMessage } from '../lib/errors'
import { addDays, isoDate, monday } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Covers as Row } from '../types'

/**
 * Lunch and dinner counts for last week and this week, saved when a field is
 * left. A calendar on a desktop, a list on a phone; days still to come are
 * shown but can't be filled in.
 */
export function Covers() {
  const { t, lang } = useT()
  const { restaurant } = useMember()
  const [rows, setRows] = useState<Map<string, Row>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [weeks] = useState(() => {
    const thisWeek = monday(new Date())
    return [addDays(thisWeek, -7), thisWeek].map((m) =>
      Array.from({ length: 7 }, (_, i) => addDays(m, i)),
    )
  })
  const today = isoDate(new Date())
  const loc = lang === 'nl' ? 'nl-NL' : 'en-GB'

  useEffect(() => {
    fetchCovers(restaurant.id, isoDate(weeks[0][0]), isoDate(weeks[1][6])).then(
      (r) => setRows(new Map(r.map((x) => [x.day, x]))),
      (e) => setError(errorMessage(e)),
    )
  }, [restaurant.id, weeks])

  async function set(d: string, field: 'lunch' | 'dinner', raw: string) {
    const n = Math.max(0, Math.round(Number(raw) || 0))
    const row = rows.get(d) ?? { restaurant_id: restaurant.id, day: d, lunch: 0, dinner: 0 }
    if (row[field] === n) return
    const next = { ...row, [field]: n }
    setRows(new Map(rows).set(d, next))
    try {
      await saveCovers(next)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // A render function, not a component: a component defined in here would be
  // a new type every render and remount every input, stealing focus mid-tab.
  function field(d: string, f: 'lunch' | 'dinner') {
    const value = rows.get(d)?.[f]
    return (
      <input
        key={`${d}-${f}-${value ?? 0}`}
        className={`${input} num px-3 text-center disabled:opacity-40`}
        inputMode="numeric"
        disabled={d > today}
        aria-label={`${t(f)} ${d}`}
        defaultValue={value || ''}
        onBlur={(e) => void set(d, f, e.target.value)}
      />
    )
  }

  return (
    <div className={wide}>
      <PageHeader title={t('covers')} meta={t('coversHelp')} />
      {error && (
        <div className="mb-6">
          <ErrorLine message={error} />
        </div>
      )}

      {weeks.map((week, w) => (
        <section key={w} className="mb-10">
          <h2 className="mb-3 text-h3">{w === 0 ? t('prevWeek') : t('thisWeek')}</h2>

          {/* Phone: one row per day. */}
          <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 lg:hidden">
            <span />
            <span className="text-center text-ink-muted">{t('lunch')}</span>
            <span className="text-center text-ink-muted">{t('dinner')}</span>
            {week.map((date) => {
              const d = isoDate(date)
              return (
                <div key={d} className="contents">
                  <span className={d === today ? 'font-medium text-accent' : ''}>
                    {date.toLocaleDateString(loc, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  {field(d, 'lunch')}
                  {field(d, 'dinner')}
                </div>
              )
            })}
          </div>

          {/* Desktop: a week as seven columns. */}
          <div className="hidden grid-cols-7 gap-px border border-line bg-line lg:grid">
            {week.map((date) => {
              const d = isoDate(date)
              const row = rows.get(d)
              const sum = (row?.lunch ?? 0) + (row?.dinner ?? 0)
              return (
                <div
                  key={d}
                  className={`flex flex-col gap-2 p-4 ${d === today ? 'bg-accent-soft' : 'bg-paper-raised'}`}
                >
                  <p className={d === today ? 'font-medium text-accent' : 'font-medium'}>
                    {date.toLocaleDateString(loc, { weekday: 'long' })}
                    <span className="num block font-normal text-ink-muted">
                      {date.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}
                    </span>
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-ink-muted">{t('lunch')}</span>
                    {field(d, 'lunch')}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-ink-muted">{t('dinner')}</span>
                    {field(d, 'dinner')}
                  </label>
                  <p className="num mt-1 text-ink-muted">
                    {sum > 0 ? `${sum} ${t('covers').toLowerCase()}` : ' '}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
