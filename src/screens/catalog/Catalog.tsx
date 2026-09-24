import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMember } from '../../auth/authContext'
import { ScreenTitle } from '../../components/Shell'
import { chip, column, input, primaryButton, quietButton } from '../../components/styles'
import { addSupplier, deleteSupplier, renameSupplier } from '../../data/api'
import { useCatalog } from '../../data/catalogContext'
import { errorMessage } from '../../lib/errors'
import { perBigUnit } from '../../lib/format'
import { useT } from '../../lib/i18n'
import { matches } from '../../lib/search'
import type { Kind } from '../../types'

type Tab = Kind | 'suppliers'

export function Catalog() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('catalog.tab') as Tab) ?? 'raw')
  const pick = (next: Tab) => {
    sessionStorage.setItem('catalog.tab', next)
    setTab(next)
  }
  return (
    <div className={column}>
      <ScreenTitle title={t('catalog')} />
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
    </div>
  )
}

function Items({ kind }: { kind: Kind }) {
  const { t, lang } = useT()
  const { items, suppliers, loading, error } = useCatalog()
  const [term, setTerm] = useState('')
  const [archived, setArchived] = useState(false)
  const shown = items.filter(
    (i) => i.kind === kind && i.archived === archived && (!term || matches(i.name, term)),
  )

  return (
    <>
      <div className="flex gap-2">
        <input
          type="search"
          className={input}
          placeholder={t('search')}
          aria-label={t('search')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Link to={`/catalog/new/${kind}`} className={`${primaryButton} shrink-0`}>
          {t('add')}
        </Link>
      </div>
      {error && <p className="mt-4 text-danger">{error}</p>}
      {loading && <p className="mt-4 text-ink-muted">{t('loading')}</p>}
      <ul className="mt-4">
        {shown.map((i) => (
          <li key={i.id} className="border-b border-line">
            <Link
              to={`/catalog/${i.id}`}
              className="flex min-h-16 items-center justify-between gap-4 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-lg">{i.name}</span>
                <span className="block text-ink-muted">
                  {[
                    suppliers.find((s) => s.id === i.supplier_id)?.name,
                    i.yield_pct != null && `${i.yield_pct}%`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
            </Link>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`${quietButton} mt-4 -ml-6`}
        onClick={() => setArchived(!archived)}
      >
        {archived ? `← ${t('back')}` : t('showArchived')}
      </button>
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
        <button className={`${primaryButton} shrink-0`}>{t('add')}</button>
      </form>
      {error && <p className="mt-4 text-danger">{error}</p>}
      <ul className="mt-4">
        {suppliers.map((s) => (
          <li
            key={s.id}
            className="flex min-h-16 items-center justify-between gap-2 border-b border-line"
          >
            <input
              className="min-h-12 flex-1 bg-transparent text-lg focus:outline-none"
              defaultValue={s.name}
              aria-label={t('name')}
              onBlur={(e) => {
                const clean = e.target.value.trim()
                if (clean && clean !== s.name) void run(() => renameSupplier(s.id, clean))
              }}
            />
            <button
              type="button"
              className={quietButton}
              onClick={() =>
                window.confirm(`${t('delete')}: ${s.name}?`) && void run(() => deleteSupplier(s.id))
              }
            >
              {t('delete')}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
