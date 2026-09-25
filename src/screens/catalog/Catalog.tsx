import { useState } from 'react'
import { Link, NavLink, useOutlet } from 'react-router-dom'
import {
  BooksIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useMember } from '../../auth/authContext'
import { PageHeader } from '../../components/Shell'
import { Empty, ErrorLine, SkeletonRows } from '../../components/States'
import {
  chip,
  iconButton,
  input,
  panel,
  primaryButton,
  quietButton,
  wide,
} from '../../components/styles'
import { addSupplier, deleteSupplier, renameSupplier } from '../../data/api'
import { useCatalog } from '../../data/catalogContext'
import { errorMessage } from '../../lib/errors'
import { perBigUnit } from '../../lib/format'
import { useT } from '../../lib/i18n'
import { matches } from '../../lib/search'
import type { Kind } from '../../types'

type Tab = Kind | 'suppliers'

/**
 * Master-detail. On a desktop the list stays on the left while an item is
 * open on the right; on a phone the editor takes the whole screen.
 */
export function Catalog() {
  const { t } = useT()
  const outlet = useOutlet()
  const { items } = useCatalog()
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('catalog.tab') as Tab) ?? 'raw')
  const pick = (next: Tab) => {
    sessionStorage.setItem('catalog.tab', next)
    setTab(next)
  }
  // The "pick something" panel only makes sense when there is something to pick.
  const side = outlet || (tab !== 'suppliers' && items.some((i) => i.kind === tab && !i.archived))
  return (
    <div className={wide}>
      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
        <div
          className={`${side ? 'lg:col-span-5' : 'lg:col-span-8'} ${outlet ? 'hidden lg:block' : ''}`}
        >
          <PageHeader title={t('catalog')} />
          <TabsAndList tab={tab} pick={pick} />
        </div>
        <div
          className={`lg:sticky lg:top-8 lg:col-span-7 lg:mt-12 ${outlet ? '' : 'hidden'} ${side ? 'lg:block' : ''}`}
        >
          {outlet ?? (
            <div className={`${panel} flex flex-col items-center gap-3 px-8 py-16 text-center`}>
              <PencilSimpleIcon size={36} className="text-accent" aria-hidden />
              <p className="font-display text-h3">{t('pickToEdit')}</p>
              <p className="text-ink-muted">{t('pickToEditHelp')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabsAndList({ tab, pick }: { tab: Tab; pick: (t: Tab) => void }) {
  const { t } = useT()
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" className={chip(tab === 'raw')} onClick={() => pick('raw')}>
          {t('products')}
        </button>
        <button type="button" className={chip(tab === 'prep')} onClick={() => pick('prep')}>
          {t('components')}
        </button>
        <button
          type="button"
          className={chip(tab === 'suppliers')}
          onClick={() => pick('suppliers')}
        >
          {t('suppliers')}
        </button>
      </div>
      {tab === 'suppliers' ? <Suppliers /> : <Items kind={tab} />}
    </>
  )
}

function Items({ kind }: { kind: Kind }) {
  const { t, lang } = useT()
  const { items, suppliers, loading, error, reload } = useCatalog()
  const [term, setTerm] = useState('')
  const [archived, setArchived] = useState(false)
  const ofKind = items.filter((i) => i.kind === kind)
  const none = !loading && !ofKind.some((i) => !i.archived)
  const hasArchived = ofKind.some((i) => i.archived)
  const shown = items.filter(
    (i) => i.kind === kind && i.archived === archived && (!term || matches(i.name, term)),
  )

  return (
    <>
      <div className={`gap-2 ${none && !archived ? 'hidden' : 'flex'}`}>
        <span className="relative flex-1">
          <MagnifyingGlassIcon
            size={20}
            className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            className={`${input} pl-12`}
            placeholder={t('search')}
            aria-label={t('search')}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </span>
        <Link to={`/catalog/new/${kind}`} className={`${primaryButton} shrink-0`}>
          <PlusIcon size={18} weight="bold" aria-hidden />
          {t('add')}
        </Link>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorLine message={error} onRetry={() => void reload()} />
        </div>
      )}
      {loading && <SkeletonRows rows={6} tall />}
      {none && !archived && (
        <Empty icon={BooksIcon} title={kind === 'raw' ? t('noProducts') : t('noComponents')}>
          <p className="max-w-[60ch] text-ink-muted">
            {kind === 'raw' ? t('noProductsHelp') : t('noComponentsHelp')}
          </p>
          <Link to={`/catalog/new/${kind}`} className={`${primaryButton} mt-2`}>
            <PlusIcon size={18} weight="bold" aria-hidden />
            {kind === 'raw' ? t('newProduct') : t('newComponent')}
          </Link>
        </Empty>
      )}
      <ul className="mt-4">
        {shown.map((i) => (
          <li key={i.id} className="border-b border-line">
            <NavLink
              to={`/catalog/${i.id}`}
              className={({ isActive }) =>
                `flex min-h-16 items-center justify-between gap-4 py-2 transition-colors lg:-mx-4 lg:px-4 ${
                  isActive ? 'lg:bg-accent-soft' : 'lg:hover:bg-paper-sunk/60'
                }`
              }
            >
              <span className="min-w-0">
                <span className="block truncate text-lg">{i.name}</span>
                <span className="block text-ink-muted">
                  {[
                    suppliers.find((s) => s.id === i.supplier_id)?.name,
                    i.yield_pct != null && `${i.yield_pct}%`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </span>
              <span className="num shrink-0 text-right">
                {i.unit_cost != null ? (
                  <span className="text-highlight">{perBigUnit(i.unit_cost, i.unit, lang)}</span>
                ) : (
                  <span className="text-danger">
                    {i.kind === 'raw' ? t('missingPrice') : t('missingBatch')}
                  </span>
                )}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
      {hasArchived && (
        <button
          type="button"
          className={`${quietButton} mt-4`}
          onClick={() => setArchived(!archived)}
        >
          {archived ? t('hideArchived') : t('showArchived')}
        </button>
      )}
    </>
  )
}

function Suppliers() {
  const { t } = useT()
  const { restaurant } = useMember()
  const { suppliers, reload } = useCatalog()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function run(work: () => Promise<unknown>): Promise<boolean> {
    try {
      await work()
      setError(null)
      await reload()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const clean = name.trim()
          if (clean)
            void run(() => addSupplier(restaurant.id, clean)).then((ok) => ok && setName(''))
        }}
      >
        <input
          className={input}
          placeholder={t('newSupplier')}
          aria-label={t('newSupplier')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={`${primaryButton} shrink-0`}>
          <PlusIcon size={18} weight="bold" aria-hidden />
          {t('add')}
        </button>
      </form>
      {error && (
        <div className="mt-4">
          <ErrorLine message={error} />
        </div>
      )}
      <ul className="mt-4">
        {suppliers.map((s) => (
          <li
            key={s.id}
            className="flex min-h-16 items-center justify-between gap-2 border-b border-line"
          >
            <input
              className="min-h-12 flex-1 rounded-full bg-transparent px-3 text-lg -ml-3 hover:bg-paper-raised focus:bg-paper-raised focus:outline-none"
              defaultValue={s.name}
              aria-label={t('name')}
              onBlur={(e) => {
                const clean = e.target.value.trim()
                if (clean && clean !== s.name) void run(() => renameSupplier(s.id, clean))
              }}
            />
            <button
              type="button"
              className={iconButton}
              aria-label={`${t('delete')}: ${s.name}`}
              title={t('delete')}
              onClick={() =>
                window.confirm(`${t('delete')}: ${s.name}?`) && void run(() => deleteSupplier(s.id))
              }
            >
              <TrashIcon size={20} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
