import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth, useMember } from '../auth/authContext'
import { useT, type Key } from '../lib/i18n'
import { Logo } from './Logo'

/**
 * The deep header band (the website's footer colour) and a tab bar at the
 * bottom, where a thumb already is.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useT()
  const { signOut } = useAuth()
  const { member, isChef } = useMember()

  const tabs: [string, Key][] = isChef
    ? [
        ['/', 'navLog'],
        ['/overview', 'navOverview'],
        ['/week', 'navWeek'],
        ['/more', 'navMore'],
      ]
    : [
        ['/', 'navLog'],
        ['/mine', 'navMine'],
        ['/more', 'navMore'],
      ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-deep pt-[env(safe-area-inset-top)] text-on-deep">
        <div className="page-x mx-auto flex h-16 max-w-2xl items-center justify-between gap-4">
          <Logo className="h-5" />
          <div className="flex items-center gap-3">
            <span className="truncate text-on-deep-muted">{member.name}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-11 rounded-full border border-on-deep-muted px-4 text-on-deep transition active:scale-[.98]"
            >
              {t('switchUser')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map(([to, key]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-1 items-center justify-center font-medium ${
                  isActive
                    ? 'text-accent underline decoration-2 underline-offset-8'
                    : 'text-ink-muted'
                }`
              }
            >
              {t(key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Title block at the top of a screen: the website's eyebrow + serif heading. */
export function ScreenTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mt-8 mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-h2">{title}</h1>
      </div>
      {children}
    </div>
  )
}
