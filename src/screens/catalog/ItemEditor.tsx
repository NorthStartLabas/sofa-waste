import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMember } from '../../auth/authContext'
import { ScreenTitle } from '../../components/Shell'
import {
  chip,
  column,
  dangerButton,
  input,
  primaryButton,
  quietButton,
  secondaryButton,
  select,
} from '../../components/styles'
import { deleteItem, saveItem, saveRecipe, setArchived } from '../../data/api'
import { useCatalog } from '../../data/catalogContext'
import { errorMessage } from '../../lib/errors'
import { perBigUnit } from '../../lib/format'
import { useT } from '../../lib/i18n'
import { parseNumber, showNumber } from '../../lib/numbers'
import { matches } from '../../lib/search'
import type { Item, Kind, Unit } from '../../types'

const UNITS: Unit[] = ['g', 'ml', 'pcs']

/** Typing 6 L is easier than 6000 ml; everything is stored in the small unit. */
const BIG: Record<Unit, { label: string; factor: number } | null> = {
  g: { label: 'kg', factor: 1000 },
  ml: { label: 'L', factor: 1000 },
  pcs: null,
}

type Line = { ingredient_item_id: string; qty: string }

export function ItemEditor() {
  const { id, kind: newKind } = useParams()
  const catalog = useCatalog()
  const existing = catalog.items.find((i) => i.id === id)
  if (id && !existing) {
    return <div className={column}>{catalog.loading ? '…' : '404'}</div>
  }
  // key: switching from one item to another must start from fresh state.
  return (
    <Editor
      key={id ?? newKind}
      existing={existing ?? null}
      kind={(existing?.kind ?? newKind) as Kind}
    />
  )
}

function Editor({ existing, kind }: { existing: Item | null; kind: Kind }) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { restaurant } = useMember()
  const catalog = useCatalog()

  const [name, setName] = useState(existing?.name ?? '')
  const [unit, setUnit] = useState<Unit>(existing?.unit ?? 'g')
  const [stationId, setStationId] = useState(existing?.station_id ?? null)
  const [supplierId, setSupplierId] = useState(existing?.supplier_id ?? '')
  // Shown in the big unit when the stored value is a round number of them.
  const startBig = (q: number | null | undefined, u: Unit) =>
    !!BIG[u] && q != null && q >= 1000 && q % 100 === 0
  const [packBig, setPackBig] = useState(startBig(existing?.pack_qty, existing?.unit ?? 'g'))
  const [packQty, setPackQty] = useState(
    showNumber(existing?.pack_qty != null ? existing.pack_qty / (packBig ? 1000 : 1) : null),
  )
  const [packPrice, setPackPrice] = useState(showNumber(existing?.pack_price))
  const [yieldPct, setYieldPct] = useState(showNumber(existing?.yield_pct))
  const [batchBig, setBatchBig] = useState(startBig(existing?.batch_qty, existing?.unit ?? 'g'))
  const [batchQty, setBatchQty] = useState(
    showNumber(existing?.batch_qty != null ? existing.batch_qty / (batchBig ? 1000 : 1) : null),
  )
  const currentLines = useMemo(
    () => catalog.recipeLines.filter((l) => existing && l.prep_item_id === existing.id),
    [catalog.recipeLines, existing],
  )
  const [lines, setLines] = useState<Line[]>(
    currentLines.map((l) => ({ ingredient_item_id: l.ingredient_item_id, qty: showNumber(l.qty) })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => new Map(catalog.items.map((i) => [i.id, i])), [catalog.items])
  const packBase = (parseNumber(packQty) ?? 0) * (packBig ? 1000 : 1) || null
  const batchBase = (parseNumber(batchQty) ?? 0) * (batchBig ? 1000 : 1) || null
  const price = parseNumber(packPrice)
  const yld = parseNumber(yieldPct)

  // The same sum the server does, for feedback while typing. The server's
  // number is the one that gets saved on an entry.
  const liveCost: number | null = useMemo(() => {
    if (kind === 'raw') return price != null && packBase ? price / packBase : null
    if (!batchBase || lines.length === 0) return null
    let total = 0
    for (const l of lines) {
      const cost = byId.get(l.ingredient_item_id)?.unit_cost
      const q = parseNumber(l.qty)
      if (cost == null || !q) return null
      total += cost * q
    }
    return total / batchBase
  }, [kind, price, packBase, batchBase, lines, byId])

  async function save() {
    if (!name.trim()) return setError(t('name'))
    setBusy(true)
    setError(null)
    try {
      const savedId = await saveItem(existing?.id ?? null, {
        restaurant_id: restaurant.id,
        kind,
        name: name.trim(),
        unit,
        station_id: stationId,
        supplier_id: kind === 'raw' ? supplierId || null : null,
        pack_qty: kind === 'raw' ? packBase : null,
        pack_price: kind === 'raw' ? price : null,
        yield_pct: kind === 'raw' ? yld : null,
        batch_qty: kind === 'prep' ? batchBase : null,
        archived: existing?.archived ?? false,
      })
      if (kind === 'prep') {
        await saveRecipe(
          restaurant.id,
          savedId,
          currentLines,
          lines.flatMap((l) => {
            const q = parseNumber(l.qty)
            return q && q > 0 ? [{ ingredient_item_id: l.ingredient_item_id, qty: q }] : []
          }),
        )
      }
      await catalog.reload()
      navigate('/catalog')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  async function run(work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      await catalog.reload()
      navigate('/catalog')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className={column}>
      <button
        type="button"
        className={`${quietButton} -ml-6 mt-4`}
        onClick={() => navigate('/catalog')}
      >
        ← {t('catalog')}
      </button>
      <ScreenTitle
        eyebrow={kind === 'raw' ? t('products') : t('components')}
        title={existing ? existing.name : kind === 'raw' ? t('newProduct') : t('newComponent')}
      />

      <div className="flex flex-col gap-6">
        <Field label={t('name')}>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label={t('unit')} help={t('unitHelp')}>
          <div className="flex gap-2">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={chip(unit === u)}
                onClick={() => {
                  setUnit(u)
                  if (!BIG[u]) {
                    setPackBig(false)
                    setBatchBig(false)
                  }
                }}
              >
                {t(`unit_${u}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('station')}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chip(stationId === null)}
              onClick={() => setStationId(null)}
            >
              {t('none')}
            </button>
            {catalog.stations.map((s) => (
              <button
                key={s.id}
                type="button"
                className={chip(stationId === s.id)}
                onClick={() => setStationId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </Field>

        {kind === 'raw' ? (
          <>
            <Field label={t('supplier')}>
              <select
                className={select}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">{t('none')}</option>
                {catalog.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('packQty')}>
              <Amount
                value={packQty}
                onChange={setPackQty}
                unit={unit}
                big={packBig}
                onBig={setPackBig}
              />
            </Field>
            <Field label={t('packPrice')}>
              <div className="flex items-center gap-2">
                <span className="text-lg">€</span>
                <input
                  className={`${input} num`}
                  inputMode="decimal"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                />
              </div>
            </Field>
            <Field label={t('yieldPct')} help={t('yieldHelp')}>
              <input
                className={`${input} num`}
                inputMode="decimal"
                value={yieldPct}
                onChange={(e) => setYieldPct(e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Recipe lines={lines} setLines={setLines} selfId={existing?.id} />
            <Field label={t('batchQty')} help={t('batchHelp')}>
              <Amount
                value={batchQty}
                onChange={setBatchQty}
                unit={unit}
                big={batchBig}
                onBig={setBatchBig}
              />
            </Field>
          </>
        )}

        <div className="border-t border-line pt-4">
          <p className="eyebrow mb-1">{t('costPerUnit')}</p>
          <p className="num text-h3 font-display text-highlight">
            {liveCost != null ? (
              perBigUnit(liveCost, unit, lang)
            ) : (
              <span className="text-danger">{t('incomplete')}</span>
            )}
          </p>
          {kind === 'raw' && liveCost != null && yld != null && yld > 0 && (
            <p className="num text-ink-muted">
              {t('costPerUnitCleaned')}: {perBigUnit(liveCost / (yld / 100), unit, lang)}
            </p>
          )}
        </div>

        {error && <p className="text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2 pb-8">
          <button
            type="button"
            className={primaryButton}
            disabled={busy}
            onClick={() => void save()}
          >
            {t('save')}
          </button>
          {existing && (
            <>
              <button
                type="button"
                className={secondaryButton}
                disabled={busy}
                onClick={() => void run(() => setArchived(existing.id, !existing.archived))}
              >
                {existing.archived ? t('unarchive') : t('archive')}
              </button>
              <button
                type="button"
                className={dangerButton}
                disabled={busy}
                onClick={() =>
                  window.confirm(`${t('delete')}: ${existing.name}?`) &&
                  void run(() => deleteItem(existing.id))
                }
              >
                {t('delete')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      {help && <span className="-mt-1 text-ink-muted">{help}</span>}
      {children}
    </div>
  )
}

function Amount({
  value,
  onChange,
  unit,
  big,
  onBig,
}: {
  value: string
  onChange: (v: string) => void
  unit: Unit
  big: boolean
  onBig: (b: boolean) => void
}) {
  const { t } = useT()
  const bigUnit = BIG[unit]
  return (
    <div className="flex items-center gap-2">
      <input
        className={`${input} num`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className={chip(!big)} onClick={() => onBig(false)}>
        {t(`unit_${unit}`)}
      </button>
      {bigUnit && (
        <button type="button" className={chip(big)} onClick={() => onBig(true)}>
          {bigUnit.label}
        </button>
      )}
    </div>
  )
}

function Recipe({
  lines,
  setLines,
  selfId,
}: {
  lines: Line[]
  setLines: (l: Line[]) => void
  selfId?: string
}) {
  const { t, lang } = useT()
  const { items } = useCatalog()
  const [term, setTerm] = useState('')
  const byId = new Map(items.map((i) => [i.id, i]))
  const used = new Set(lines.map((l) => l.ingredient_item_id))
  const options = term
    ? items
        .filter((i) => i.id !== selfId && !i.archived && !used.has(i.id) && matches(i.name, term))
        .slice(0, 8)
    : []

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">{t('recipe')}</span>
      <span className="-mt-1 text-ink-muted">{t('recipeHelp')}</span>
      <ul>
        {lines.map((l, idx) => {
          const ing = byId.get(l.ingredient_item_id)
          return (
            <li
              key={l.ingredient_item_id}
              className="flex min-h-16 items-center gap-2 border-b border-line py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{ing?.name ?? '?'}</span>
                <span className="block text-ink-muted">
                  {ing?.unit_cost != null ? (
                    perBigUnit(ing.unit_cost, ing.unit, lang)
                  ) : (
                    <span className="text-danger">{t('incomplete')}</span>
                  )}
                </span>
              </span>
              <input
                className={`${input} num w-28`}
                inputMode="decimal"
                aria-label={t('quantity')}
                value={l.qty}
                onChange={(e) =>
                  setLines(lines.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                }
              />
              <span className="w-8 text-ink-muted">{ing ? t(`unit_${ing.unit}`) : ''}</span>
              <button
                type="button"
                aria-label={t('delete')}
                className="min-h-12 min-w-12 text-2xl text-ink-muted"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <input
        type="search"
        className={input}
        placeholder={t('addIngredient')}
        aria-label={t('addIngredient')}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      {options.length > 0 && (
        <ul className="border border-line bg-paper-raised">
          {options.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between px-5 text-left"
                onClick={() => {
                  setLines([...lines, { ingredient_item_id: i.id, qty: '' }])
                  setTerm('')
                }}
              >
                <span>{i.name}</span>
                <span className="text-ink-muted">{t(`unit_${i.unit}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
