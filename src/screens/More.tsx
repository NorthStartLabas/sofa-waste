import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useMember } from '../auth/authContext'
import { CaretRightIcon, SignOutIcon } from '@phosphor-icons/react'
import { PageHeader } from '../components/Shell'
import { chip, column, secondaryButton } from '../components/styles'
import { isShared, setShared } from '../lib/device'
import { useT, type Key } from '../lib/i18n'

export function More() {
  const { t, lang, setLang } = useT()
  const { signOut } = useAuth()
  const { member, isChef, isAdmin, isManager } = useMember()
  const [shared, setSharedState] = useState(isShared)

  const links: [string, Key, boolean][] = [
    ['/mine', 'navMine', isChef],
    ['/catalog', 'catalog', isChef],
    ['/covers', 'covers', isChef],
    ['/users', 'users', isAdmin],
    ['/audit', 'audit', isManager],
  ]

  return (
    <div className={column}>
      <PageHeader title={t('settings')} meta={t('signedInAs', { name: member.name })} />
      <ul className="mb-8">
        {links
          .filter(([, , show]) => show)
          .map(([to, key]) => (
            <li key={to} className="border-b border-line">
              <Link to={to} className="flex min-h-16 items-center justify-between text-lg">
                {t(key)}
                <CaretRightIcon size={20} className="text-ink-muted" aria-hidden />
              </Link>
            </li>
          ))}
      </ul>

      <h2 className="mb-2 text-h3">{t('language')}</h2>
      <div className="mb-8 flex gap-2">
        <button type="button" className={chip(lang === 'nl')} onClick={() => setLang('nl')}>
          Nederlands
        </button>
        <button type="button" className={chip(lang === 'en')} onClick={() => setLang('en')}>
          English
        </button>
      </div>

      <h2 className="mb-1 text-h3">{t('sharedDevice')}</h2>
      <p className="mb-3 text-ink-muted">{t('sharedDeviceHelp')}</p>
      <div className="mb-8 flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            className={chip(shared === v)}
            onClick={() => {
              setShared(v)
              setSharedState(v)
            }}
          >
            {v ? t('on') : t('off')}
          </button>
        ))}
      </div>

      <button type="button" className={secondaryButton} onClick={() => void signOut()}>
        <SignOutIcon size={20} aria-hidden />
        {t('signOut')}
      </button>
    </div>
  )
}
