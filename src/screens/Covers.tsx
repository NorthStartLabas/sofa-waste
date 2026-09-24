import { useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { ScreenTitle } from '../components/Shell'
import { column, input } from '../components/styles'
import { fetchCovers, saveCovers } from '../data/api'
import { errorMessage } from '../lib/errors'
import { addDays, day, isoDate } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Covers as Row } from '../types'

const DAYS = 14

/** Lunch and dinner counts, the last two weeks. Saved when a field is left. */
export function Covers() {
  const { t, lang } = useT()
  const { restaurant } = useMember()
  const [rows, setRows] = useState<Map<string, Row>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [days] = useState(() =>
    Array.from({ length: DAYS }, (_, i) => isoDate(addDays(new Date(), -i))),
  )

  useEffect(() => {
    fetchCovers(restaurant.id, days[DAYS - 1], days[0]).then(
      (r) => setRows(new Map(r.map((x) => [x.day, x]))),
      (e) => setError(errorMessage(e)),
    )
  }, [restaurant.id, days])

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

  return (
    <div className={column}>
      <ScreenTitle title={t('covers')} />
      <p className="mb-6 text-ink-muted">{t('coversHelp')}</p>
      {error && <p className="mb-4 text-danger">{error}</p>}
      <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-x-2 gap-y-2">
        <span />
        <span className="eyebrow text-center">{t('lunch')}</span>
        <span className="eyebrow text-center">{t('dinner')}</span>
        {days.map((d) => (
          <div key={d} className="contents">
            <span>{day(`${d}T12:00`, lang)}</span>
            {(['lunch', 'dinner'] as const).map((f) => (
              <input
                key={`${d}-${f}-${rows.get(d)?.[f] ?? 0}`}
                className={`${input} num px-3 text-center`}
                inputMode="numeric"
                aria-label={`${t(f)} ${d}`}
                defaultValue={rows.get(d)?.[f] || ''}
                onBlur={(e) => void set(d, f, e.target.value)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
