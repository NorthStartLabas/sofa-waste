import { useCallback, useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { EntryRow } from '../components/EntryRow'
import { groupByDay } from '../lib/groupByDay'
import { Link } from 'react-router-dom'
import { ListBulletsIcon } from '@phosphor-icons/react'
import { PageHeader } from '../components/Shell'
import { Empty, ErrorLine, SkeletonRows } from '../components/States'
import { column, dangerButton, money, primaryButton } from '../components/styles'
import { deleteEntry, fetchMyEntries } from '../data/api'
import { useCatalog } from '../data/catalogContext'
import { errorMessage } from '../lib/errors'
import { day, euro, isoDate, monday } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Entry } from '../types'

const UNDO_MS = 10 * 60 * 1000

/** A cook's own week. Anything under ten minutes old can still be taken back. */
export function MyEntries() {
  const { t, lang } = useT()
  const { member } = useMember()
  const { stations } = useCatalog()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setEntries(await fetchMyEntries(member.user_id, monday(new Date())))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [member.user_id])

  useEffect(() => {
    void load()
    const tick = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(tick)
  }, [load])

  async function remove(id: string) {
    try {
      if (!(await deleteEntry(id))) setError(t('undoExpired'))
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const total = (entries ?? []).reduce((s, e) => s + (e.cost ?? 0), 0)
  const today = isoDate(new Date())

  return (
    <div className={column}>
      <PageHeader title={t('navMine')} meta={t('thisWeek')}>
        <span className={`${money} text-h3`}>{euro(total, lang)}</span>
      </PageHeader>
      {error && (
        <div className="mb-4">
          <ErrorLine message={error} onRetry={() => void load()} />
        </div>
      )}
      {entries === null && !error && <SkeletonRows tall />}
      {entries?.length === 0 && (
        <Empty icon={ListBulletsIcon} title={t('nothingYet')}>
          <p className="text-ink-muted">{t('nothingYetHelp')}</p>
          <Link to="/" className={primaryButton}>
            {t('navLog')}
          </Link>
        </Empty>
      )}
      {groupByDay(entries ?? []).map(([key, rows]) => (
        <section key={key} className="mb-6">
          <p className="eyebrow mb-1">
            {key === today ? t('today') : day(rows[0].logged_at, lang)}
          </p>
          <ul>
            {rows.map((e) => {
              const left = UNDO_MS - (now - new Date(e.logged_at).getTime())
              return (
                <EntryRow
                  key={e.id}
                  entry={e}
                  stationName={stations.find((s) => s.id === e.station_id)?.name}
                >
                  {left > 0 && (
                    <div className="flex items-center justify-between gap-3 pb-3">
                      <span className="text-ink-muted">
                        {t('canUndoFor', { min: Math.ceil(left / 60000) })}
                      </span>
                      <button
                        type="button"
                        className={dangerButton}
                        onClick={() => void remove(e.id)}
                      >
                        {t('undo')}
                      </button>
                    </div>
                  )}
                </EntryRow>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
