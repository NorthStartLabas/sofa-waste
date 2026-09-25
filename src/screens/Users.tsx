import { useCallback, useEffect, useState } from 'react'
import { useMember } from '../auth/authContext'
import { InfoIcon, KeyIcon, TrashIcon, UserPlusIcon } from '@phosphor-icons/react'
import { PageHeader } from '../components/Shell'
import {
  chip,
  dangerButton,
  help,
  input,
  label,
  panel,
  primaryButton,
  secondaryButton,
  wide,
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
    <div className={wide}>
      <PageHeader title={t('users')} meta={t('nPeople', { n: members.length })} />
      {notice && (
        <p
          className="mb-6 flex items-start gap-3 border-l-2 border-accent bg-accent-soft px-4 py-3 text-accent"
          role="status"
        >
          <InfoIcon size={20} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
        <form
          className={`${panel} mb-10 flex flex-col gap-4 p-5 lg:sticky lg:top-8 lg:col-span-4 lg:p-6`}
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <h2 className="text-h3">{t('newUser')}</h2>
          <label className="flex flex-col gap-2">
            <span className={label}>{t('name')}</span>
            <input
              className={input}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={label}>{t('email')}</span>
            <input
              className={input}
              type="email"
              required
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className={help}>{t('emailHelp')}</span>
          </label>
          <div className="flex flex-col gap-2">
            <span className={label}>{t('role')}</span>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={chip(role === r)}
                  onClick={() => setRole(r)}
                >
                  {t(`role_${r}`)}
                </button>
              ))}
            </div>
          </div>
          <button className={`${primaryButton} mt-2`} disabled={busy}>
            <UserPlusIcon size={20} aria-hidden />
            {t('add')}
          </button>
        </form>

        <ul className="lg:col-span-8">
          {members.map((m) => (
            <li
              key={m.user_id}
              className={`border-b border-line py-5 ${m.active ? '' : 'opacity-60'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-lg font-medium">{m.name}</p>
                <p className="text-ink-muted">
                  {t(`role_${m.role}`)}
                  {m.must_change_pin && `, ${t('mustChangePin')}`}
                  {!m.active && `, ${t('inactive').toLowerCase()}`}
                </p>
              </div>
              <p className="text-ink-muted">{m.email}</p>
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
                  <span className="hidden w-px self-stretch bg-line sm:block" aria-hidden />
                  <button type="button" className={secondaryButton} onClick={() => void reset(m)}>
                    <KeyIcon size={18} aria-hidden />
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
                    <TrashIcon size={18} aria-hidden />
                    {t('delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
