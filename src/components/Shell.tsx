import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BooksIcon,
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  DotsThreeCircleIcon,
  ForkKnifeIcon,
  GearSixIcon,
  ListBulletsIcon,
  NotebookIcon,
  ScalesIcon,
  UserSwitchIcon,
  UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth, useMember } from '../auth/authContext'
import { useT, type Key } from '../lib/i18n'
import { Logo } from './Logo'

type NavItem = { to: string; key: Key; icon: Icon }

/**
 * Two shells around one set of screens. Below 1024px: the deep header band
 * and a tab bar at the bottom, where the thumb is. From 1024px: a deep
 * sidebar with everything the role can reach, and the tab bar goes away.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { t } = useT()
  const { signOut } = useAuth()
  const { member, isChef, isAdmin, isManager } = useMember()

  const tabs: NavItem[] = isChef
    ? [
        { to: '/', key: 'navLog', icon: ScalesIcon },
        { to: '/overview', key: 'navOverview', icon: NotebookIcon },
        { to: '/week', key: 'navWeek', icon: ChartBarIcon },
        { to: '/more', key: 'navMore', icon: DotsThreeCircleIcon },
      ]
    : [
        { to: '/', key: 'navLog', icon: ScalesIcon },
        { to: '/mine', key: 'navMine', icon: ListBulletsIcon },
        { to: '/more', key: 'navMore', icon: DotsThreeCircleIcon },
      ]

  const side: NavItem[] = [
    { to: '/', key: 'navLog', icon: ScalesIcon },
    { to: '/mine', key: 'navMine', icon: ListBulletsIcon },
    ...(isChef
      ? [
          { to: '/overview', key: 'navOverview', icon: NotebookIcon } as NavItem,
          { to: '/week', key: 'navWeek', icon: ChartBarIcon } as NavItem,
          { to: '/catalog', key: 'catalog', icon: BooksIcon } as NavItem,
          { to: '/covers', key: 'covers', icon: ForkKnifeIcon } as NavItem,
        ]
      : []),
    ...(isAdmin ? [{ to: '/users', key: 'users', icon: UsersThreeIcon } as NavItem] : []),
    ...(isManager
      ? [{ to: '/audit', key: 'audit', icon: ClockCounterClockwiseIcon } as NavItem]
      : []),
    { to: '/more', key: 'settings', icon: GearSixIcon },
  ]

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--color-deep)_15rem,transparent_15rem)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-deep px-4 py-6 text-on-deep lg:flex">
        <Logo className="mb-10 ml-3 h-6" />
        <nav className="flex flex-1 flex-col gap-1">
          {side.map(({ to, key, icon: I }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-full px-4 transition-colors ${
                  isActive
                    ? 'bg-on-deep/12 text-on-deep'
                    : 'text-on-deep-muted hover:bg-on-deep/6 hover:text-on-deep'
                }`
              }
            >
              <I size={22} weight="regular" aria-hidden />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-on-deep/15 pt-4">
          <p className="mb-2 truncate px-4 text-on-deep-muted">{member.name}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-12 w-full items-center gap-3 rounded-full px-4 text-on-deep transition-colors hover:bg-on-deep/6"
          >
            <UserSwitchIcon size={22} aria-hidden />
            {t('switchUser')}
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="bg-deep pt-[env(safe-area-inset-top)] text-on-deep lg:hidden">
          <div className="page-x flex h-14 items-center justify-between gap-4">
            <Logo className="h-5" />
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-on-deep-muted">{member.name}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-on-deep/30 px-4 transition active:scale-[.98]"
              >
                <UserSwitchIcon size={18} aria-hidden />
                {t('switchUser')}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-16">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl">
            {tabs.map(({ to, key, icon: I }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[0.8125rem] font-medium ${
                    isActive ? 'text-accent' : 'text-ink-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                        isActive ? 'bg-accent-soft' : ''
                      }`}
                    >
                      <I size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                    </span>
                    {t(key)}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

/**
 * The top of every screen: serif title, an optional line of facts under it
 * (a count, a date range), and actions on the right.
 */
export function PageHeader({
  title,
  meta,
  children,
}: {
  title: string
  meta?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mt-6 mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mt-12 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-h2">{title}</h1>
        {meta && <p className="mt-1 text-ink-muted">{meta}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  )
}
