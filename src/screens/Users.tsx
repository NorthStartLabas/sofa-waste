import { useCallback, useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { ScreenTitle } from '../components/Shell'
import {
  chip,
  column,
  dangerButton,
  input,
  primaryButton,
  secondaryButton,
} from '../components/styles'
import { fetchMembers, updateMember } from '../data/api'
import { errorMessage } from '../lib/errors'
import { useT } from '../lib/i18n'
import { callFunction } from '../lib/supabase'
import type { Member, Role } from '../types'

const ROLES: Role[] = ['cook', 'chef', 'admin']

/** Admins add people (a PIN goes out by email), change roles, switch people off. */
export function Users() {
  const { t } = useT()
  const { restaurant, member: me } = useMember()
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('cook')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () => fetchMembers(restaurant.id).then(setMembers, (e) => setNotice(errorMessage(e))),
    [restaurant.id],
  )
  useEffect(() => {
    void load()
  }, [load])

  /** Both actions answer with the PIN itself when the email couldn't go out. */
  function pinNotice(
    target: string,
    data: { emailed?: boolean; pin?: string; error?: string },
    status: number,
  ) {
    if (status !== 200) return data.error === 'exists' ? t('userExists') : t('errorGeneric')
    return data.emailed ? t('pinSent', { email: target }) : t('pinNotSent', { pin: data.pin ?? '' })
  }

  async function create() {
    setBusy(true)
    try {
      const clean = email.trim().toLowerCase()
      const { status, data } = await callFunction<{
        emailed?: boolean
        pin?: string
        error?: string
      }>('admin-users', {
        action: 'create',
        restaurant_id: restaurant.id,
        name: name.trim(),
        email: clean,
        role,
      })
      setNotice(pinNotice(clean, data, status))
      if (status === 200) {
        setName('')
        setEmail('')
        await load()
      }
    } catch (e) {
      setNotice(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function reset(m: Member) {
    if (!window.confirm(t('confirmReset', { name: m.name }))) return
    try {
      const { status, data } = await callFunction<{
        emailed?: boolean
        pin?: string
        error?: string
      }>('admin-users', { action: 'reset', restaurant_id: restaurant.id, user_id: m.user_id })
      setNotice(pinNotice(m.email, data, status))
      await load()
    } catch (e) {
      setNotice(errorMessage(e))
    }
  }

  async function remove(m: Member) {
    if (!window.confirm(t('confirmDeleteUser', { name: m.name }))) return
    try {
      const { status } = await callFunction('admin-users', {
        action: 'delete',
        restaurant_id: restaurant.id,
        user_id: m.user_id,
      })
      setNotice(status === 200 ? t('userDeleted', { name: m.name }) : t('errorGeneric'))
      await load()
    } catch (e) {
      setNotice(errorMessage(e))
    }
  }

  async function patch(m: Member, p: Partial<Pick<Member, 'role' | 'active'>>) {
    try {
      await updateMember(restaurant.id, m.user_id, p)
      await load()
    } catch (e) {
      setNotice(errorMessage(e))
    }
  }

  return (
    <div className={column}>
      <ScreenTitle title={t('users')} />
      {notice && (
        <p className="mb-6 border border-accent bg-accent-soft p-4 text-accent" role="status">
          {notice}
        </p>
      )}

      <form
        className="mb-10 flex flex-col gap-3 border border-line bg-paper-raised p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <p className="text-h3 font-display">{t('newUser')}</p>
        <input
          className={input}
          placeholder={t('name')}
          aria-label={t('name')}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={input}
          type="email"
          placeholder={t('email')}
          aria-label={t('email')}
          required
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button key={r} type="button" className={chip(role === r)} onClick={() => setRole(r)}>
              {t(`role_${r}`)}
            </button>
          ))}
        </div>
        <button className={primaryButton} disabled={busy}>
          {t('add')}
        </button>
      </form>

      <ul>
        {members.map((m) => (
          <li
            key={m.user_id}
            className={`border-b border-line py-4 ${m.active ? '' : 'opacity-60'}`}
          >
            <p className="text-lg">{m.name}</p>
            <p className="text-ink-muted">
              {m.email}
              {m.must_change_pin && ` · ${t('mustChangePin')}`}
              {!m.active && ` · ${t('inactive')}`}
            </p>
            {m.user_id !== me.user_id && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={chip(m.role === r)}
                    onClick={() => void patch(m, { role: r })}
                  >
                    {t(`role_${r}`)}
                  </button>
                ))}
                <button type="button" className={secondaryButton} onClick={() => void reset(m)}>
                  {t('resetPin')}
                </button>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => void patch(m, { active: !m.active })}
                >
                  {m.active ? t('deactivate') : t('activate')}
                </button>
                <button type="button" className={dangerButton} onClick={() => void remove(m)}>
                  {t('delete')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
