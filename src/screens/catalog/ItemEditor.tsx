import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMember } from '../../auth/authContext'
import { ArrowLeftIcon, CameraPlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { SkeletonRows } from '../../components/States'
import {
  chip,
  iconButton,
  label as labelClass,
  dangerButton,
  input,
  inputBase,
  primaryButton,
  quietButton,
  secondaryButton,
  select,
} from '../../components/styles'
import {
  deleteItem,
  deleteProductPhoto,
  productPhotoUrl,
  saveItem,
  saveRecipe,
  setArchived,
  uploadProductPhoto,
} from '../../data/api'
import { preparePhoto, type PreparedPhoto } from '../../lib/imagePhoto'
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
    return catalog.loading ? <SkeletonRows rows={6} /> : <Navigate to="/catalog" replace />
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
  const [locationId, setLocationId] = useState(existing?.location_id ?? '')
  const [locationMissing, setLocationMissing] = useState(false)
  const [orderUnit, setOrderUnit] = useState(existing?.order_unit ?? '')
  // A new photo waiting to be uploaded on save, or "removed" to clear the old one.
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const shownPhoto =
    preview ??
    (existing?.photo_path && !photoRemoved ? productPhotoUrl(existing.photo_path, 'full') : null)
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
    if (kind === 'raw' && !locationId) return setLocationMissing(true)
    setBusy(true)
    setError(null)
    try {
      const oldPhoto = existing?.photo_path ?? null
      // New folder first, row second, old folder last: a failed save must never
      // leave the row pointing at a photo that was already deleted.
      const photoPath = photo ? await uploadProductPhoto(photo) : photoRemoved ? null : oldPhoto
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
        location_id: kind === 'raw' ? locationId : (existing?.location_id ?? null),
        order_unit: kind === 'raw' ? orderUnit.trim() || null : null,
        photo_path: photoPath,
      })
      if (oldPhoto && oldPhoto !== photoPath) await deleteProductPhoto(oldPhoto).catch(() => {})
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
    <div className="rise px-[var(--spacing-gutter)] lg:border lg:border-line lg:bg-paper-raised lg:p-8">
      <button
        type="button"
        className={`${quietButton} mt-4 lg:hidden`}
        onClick={() => navigate('/catalog')}
      >
        <ArrowLeftIcon size={20} aria-hidden />
        {t('catalog')}
      </button>
      <div className="mt-4 mb-6 flex items-start justify-between gap-4 lg:mt-0">
        <div className="min-w-0">
          <p className="text-ink-muted">{kind === 'raw' ? t('product') : t('component')}</p>
          <h1 className="text-h2">
            {existing ? existing.name : kind === 'raw' ? t('newProduct') : t('newComponent')}
          </h1>
        </div>
        <button
          type="button"
          aria-label={t('close')}
          onClick={() => navigate('/catalog')}
          className="hidden size-12 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-paper-sunk lg:flex"
        >
          <XIcon size={22} />
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <Field label={t('name')} id="f-name">
          <input
            id="f-name"
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            <Field label={t('location')} help={t('locationHelp')} id="f-location">
              {catalog.locations.length === 0 ? (
                <p className="text-danger">{t('noLocations')}</p>
              ) : (
                <select
                  id="f-location"
                  aria-describedby="f-location-help"
                  className={select}
                  value={locationId}
                  aria-invalid={locationMissing}
                  onChange={(e) => {
                    setLocationId(e.target.value)
                    setLocationMissing(false)
                  }}
                >
                  <option value="">{t('location')}</option>
                  {catalog.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
              {locationMissing && <p className="text-danger">{t('locationRequired')}</p>}
            </Field>
            <Field label={t('orderUnit')} help={t('orderUnitHelp')} id="f-order-unit">
              <input
                id="f-order-unit"
                aria-describedby="f-order-unit-help"
                className={input}
                list="order-units"
                value={orderUnit}
                onChange={(e) => setOrderUnit(e.target.value)}
              />
              <datalist id="order-units">
                {[...new Set(catalog.items.map((i) => i.order_unit).filter(Boolean))].map((u) => (
                  <option key={u} value={u!} />
                ))}
              </datalist>
            </Field>
            <Field label={t('photo')}>
              <div className="flex items-center gap-4">
                {shownPhoto && <img src={shownPhoto} alt="" className="size-20 object-cover" />}
                <button
                  type="button"
                  className={chip(false)}
                  onClick={() => fileRef.current?.click()}
                >
                  <CameraPlusIcon size={20} aria-hidden />
                  {shownPhoto ? t('replacePhoto') : t('addPhoto')}
                </button>
                {shownPhoto && (
                  <button
                    type="button"
                    className={quietButton}
                    onClick={() => {
                      setPhoto(null)
                      setPreview(null)
                      setPhotoRemoved(true)
                    }}
                  >
                    {t('removePhoto')}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const p = await preparePhoto(file)
                      setPhoto(p)
                      setPreview(URL.createObjectURL(p.full))
                      setPhotoRemoved(false)
                    } catch (err) {
                      setError(errorMessage(err))
                    }
                  }}
                />
              </div>
            </Field>
            <Field label={t('supplier')} id="f-supplier">
              <select
                id="f-supplier"
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
            <Field label={t('packQty')} id="f-pack-qty">
              <Amount
                id="f-pack-qty"
                value={packQty}
                onChange={setPackQty}
                unit={unit}
                big={packBig}
                onBig={setPackBig}
              />
            </Field>
            <Field label={t('packPrice')} id="f-pack-price">
              <div className="flex items-center gap-2">
                <span className="text-lg">€</span>
                <input
                  id="f-pack-price"
                  className={`${input} num`}
                  inputMode="decimal"
                  value={packPrice}
                  onChange={(e) => setPackPrice(e.target.value)}
                />
              </div>
            </Field>
            <Field label={t('yieldPct')} help={t('yieldHelp')} id="f-yield">
              <input
                id="f-yield"
                aria-describedby="f-yield-help"
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
            <Field label={t('batchQty')} help={t('batchHelp')} id="f-batch">
              <Amount
                id="f-batch"
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
          <p className={`${labelClass} mb-1`}>{t('costPerUnit')}</p>
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
                <TrashIcon size={18} aria-hidden />
                {t('delete')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A label above its control. With `id`, it is a real <label> tied to that
 * control (click to focus, read out by screen readers); without, it heads a
 * group of chips, where a <label> would click the first chip.
 */
function Field({
  label,
  help,
  id,
  children,
}: {
  label: string
  help?: string
  id?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {id ? (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {help && (
        <span id={id && `${id}-help`} className="-mt-1 text-ink-muted">
          {help}
        </span>
      )}
      {children}
    </div>
  )
}

function Amount({
  id,
  value,
  onChange,
  unit,
  big,
  onBig,
}: {
  id: string
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
        id={id}
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
      <span className={labelClass}>{t('recipe')}</span>
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
                className={`${inputBase} num w-24 shrink-0 px-4 text-right`}
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
                aria-label={`${t('delete')}: ${ing?.name ?? ''}`}
                className={iconButton}
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                <XIcon size={20} />
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
