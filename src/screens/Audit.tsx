import { useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { ScreenTitle } from '../components/Shell'
import { column, secondaryButton } from '../components/styles'
import { fetchAudit, fetchMembers } from '../data/api'
import { errorMessage } from '../lib/errors'
import { day, time } from '../lib/format'
import { useT, type Key } from '../lib/i18n'
import type { AuditRow } from '../types'

/** Fields that change on every write and say nothing to a person. */
const NOISE = new Set(['cost', 'updated_at'])

/** Who changed what. Only app managers can read the log (RLS), so only they see this screen. */
export function Audit() {
  const { t, lang } = useT()
  const { restaurant } = useMember()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [names, setNames] = useState(new Map<string, string>())
  const [more, setMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(before?: number) {
    try {
      const next = await fetchAudit(before)
      setRows((r) => (before ? [...r, ...next] : next))
      setMore(next.length === 100)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    void load()
    fetchMembers(restaurant.id).then(
      (m) => setNames(new Map(m.map((x) => [x.user_id, x.name]))),
      () => {},
    )
  }, [restaurant.id])

  return (
    <div className={column}>
      <ScreenTitle title={t('audit')} />
      {error && <p className="text-danger">{error}</p>}
      <ul>
        {rows.map((r) => {
          const subject = String(
            (r.new_row ?? r.old_row)?.name ?? (r.new_row ?? r.old_row)?.item_name ?? r.row_id ?? '',
          )
          return (
            <li key={r.id} className="border-b border-line py-3">
              <p>
                <span className="font-medium">
                  {r.actor ? (names.get(r.actor) ?? r.actor.slice(0, 8)) : t('system')}
                </span>{' '}
                {t(`action_${r.action}`)} {t(`table_${r.table_name}` as Key).toLowerCase()}{' '}
                <span className="font-medium">{subject}</span>
              </p>
              <p className="text-ink-muted">
                {day(r.at, lang)} {time(r.at, lang)}
              </p>
              {r.action === 'update' && <Diff before={r.old_row ?? {}} after={r.new_row ?? {}} />}
            </li>
          )
        })}
      </ul>
      {more && rows.length > 0 && (
        <button
          type="button"
          className={`${secondaryButton} my-6`}
          onClick={() => void load(rows[rows.length - 1].id)}
        >
          ↓
        </button>
      )}
    </div>
  )
}

function Diff({
  before,
  after,
}: {
  before: Record<string, unknown>
  after: Record<string, unknown>
}) {
  const changed = Object.keys(after).filter(
    (k) => !NOISE.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  )
  return (
    <ul className="num mt-1 text-ink-muted">
      {changed.map((k) => (
        <li key={k}>
          {k}: {JSON.stringify(before[k])} → {JSON.stringify(after[k])}
        </li>
      ))}
    </ul>
  )
}
