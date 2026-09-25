import { supabase } from '../lib/supabase'
import type { PreparedPhoto } from '../lib/imagePhoto'
import type {
  AuditRow,
  Covers,
  Entry,
  Item,
  Member,
  RecipeLine,
  Reason,
  Report,
  Restaurant,
  Station,
  Supplier,
  Location,
} from '../types'
import { execute, query } from './query'

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** The signed-in person's memberships. The app uses the first active one. */
export function fetchMyMemberships(userId: string) {
  return query<(Member & { restaurants: Restaurant })[]>(() =>
    supabase
      .from('members')
      .select('*, restaurants(*)')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at'),
  )
}

export async function fetchIsManager(userId: string): Promise<boolean> {
  const rows = await query<{ user_id: string }[]>(() =>
    supabase.from('app_managers').select('user_id').eq('user_id', userId),
  )
  return rows.length > 0
}

export function fetchMembers(restaurantId: string) {
  return query<Member[]>(() =>
    supabase.from('members').select('*').eq('restaurant_id', restaurantId).order('name'),
  )
}

export function updateMember(
  restaurantId: string,
  userId: string,
  patch: Partial<Pick<Member, 'name' | 'role' | 'active'>>,
) {
  return execute(() =>
    supabase.from('members').update(patch).eq('restaurant_id', restaurantId).eq('user_id', userId),
  )
}

export function updateReportEmails(restaurantId: string, emails: string[]) {
  return execute(() =>
    supabase.from('restaurants').update({ report_emails: emails }).eq('id', restaurantId),
  )
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type Catalog = {
  items: Item[]
  stations: Station[]
  suppliers: Supplier[]
  locations: Location[]
  recipeLines: RecipeLine[]
}

export async function fetchCatalog(restaurantId: string): Promise<Catalog> {
  const [items, stations, suppliers, locations, recipeLines] = await Promise.all([
    query<Item[]>(() =>
      supabase.from('items_with_cost').select('*').eq('restaurant_id', restaurantId).order('name'),
    ),
    query<Station[]>(() =>
      supabase.from('stations').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ),
    query<Supplier[]>(() =>
      supabase.from('suppliers').select('*').eq('restaurant_id', restaurantId).order('name'),
    ),
    query<Location[]>(() =>
      supabase.from('locations').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    ),
    query<RecipeLine[]>(() =>
      supabase
        .from('recipe_lines')
        .select('id, prep_item_id, ingredient_item_id, qty')
        .eq('restaurant_id', restaurantId),
    ),
  ])
  return { items, stations, suppliers, locations, recipeLines }
}

// sort_order is left out on purpose: the database places a product at the end
// of its location, and the order app owns the route after that. Sending it
// back on every save would undo a reorder made there.
export type ItemInput = Omit<Item, 'id' | 'unit_cost' | 'cleaned_unit_cost' | 'sort_order'>

export async function saveItem(id: string | null, input: ItemInput): Promise<string> {
  if (id) {
    await execute(() => supabase.from('items').update(input).eq('id', id))
    return id
  }
  const row = await query<{ id: string }>(() =>
    supabase.from('items').insert(input).select('id').single(),
  )
  return row.id
}

export function setArchived(id: string, archived: boolean) {
  return execute(() => supabase.from('items').update({ archived }).eq('id', id))
}

export function deleteItem(id: string) {
  return execute(() => supabase.from('items').delete().eq('id', id))
}

/** Replaces a component's recipe with `lines`: the smallest set of writes that gets there. */
export async function saveRecipe(
  restaurantId: string,
  prepItemId: string,
  current: RecipeLine[],
  lines: { ingredient_item_id: string; qty: number }[],
) {
  const keep = new Set(lines.map((l) => l.ingredient_item_id))
  const gone = current.filter((c) => !keep.has(c.ingredient_item_id)).map((c) => c.id)
  if (gone.length) await execute(() => supabase.from('recipe_lines').delete().in('id', gone))
  if (lines.length) {
    await execute(() =>
      supabase.from('recipe_lines').upsert(
        lines.map((l) => ({ ...l, restaurant_id: restaurantId, prep_item_id: prepItemId })),
        { onConflict: 'prep_item_id,ingredient_item_id' },
      ),
    )
  }
}

/** Suppliers and locations are both a named list; locations also have a route position. */
export type NamedTable = 'suppliers' | 'locations'

export function addNamed(
  table: NamedTable,
  restaurantId: string,
  name: string,
  sortOrder?: number,
) {
  return execute(() =>
    supabase.from(table).insert({
      restaurant_id: restaurantId,
      name,
      ...(table === 'locations' ? { sort_order: sortOrder } : {}),
    }),
  )
}

export function renameNamed(table: NamedTable, id: string, name: string) {
  return execute(() => supabase.from(table).update({ name }).eq('id', id))
}

export function deleteNamed(table: NamedTable, id: string) {
  return execute(() => supabase.from(table).delete().eq('id', id))
}

// ---------------------------------------------------------------------------
// Product photos: the order app's bucket and format, so both apps read them.
// A new folder per upload; the old one is deleted only after the row is saved.
// ---------------------------------------------------------------------------

const PRODUCT_PHOTOS = 'ingredient-photos'

export async function uploadProductPhoto(photo: PreparedPhoto): Promise<string> {
  const folder = crypto.randomUUID()
  for (const [name, blob] of [
    ['full', photo.full],
    ['thumb', photo.thumb],
  ] as const) {
    await execute(() =>
      supabase.storage
        .from(PRODUCT_PHOTOS)
        .upload(`${folder}/${name}`, blob, { contentType: photo.type, cacheControl: '31536000' }),
    )
  }
  return folder
}

export function deleteProductPhoto(folder: string) {
  return execute(() =>
    supabase.storage.from(PRODUCT_PHOTOS).remove([`${folder}/full`, `${folder}/thumb`]),
  )
}

/** Public URL, no signing: the bucket is public, like the order app's. */
export function productPhotoUrl(folder: string, size: 'full' | 'thumb'): string {
  return supabase.storage.from(PRODUCT_PHOTOS).getPublicUrl(`${folder}/${size}`).data.publicUrl
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export type NewEntry = {
  id: string
  item_id: string
  qty: number
  cleaned: boolean
  reason: Reason
  note: string | null
  station_id: string | null
  photo_path: string | null
}

/**
 * The server's trigger fills in the name, unit, price, restaurant and who
 * logged it (NOT NULL is checked after it runs); the row comes back so the
 * cook sees what it cost.
 */
export function logEntry(e: NewEntry) {
  return query<Entry>(() => supabase.from('waste_entries').insert(e).select().single())
}

/** Resolves true if it was deleted, false if RLS said no (the 10 minutes are up). */
export async function deleteEntry(id: string): Promise<boolean> {
  const rows = await query<{ id: string }[]>(() =>
    supabase.from('waste_entries').delete().eq('id', id).select('id'),
  )
  return rows.length > 0
}

export function updateEntry(
  id: string,
  patch: Partial<Pick<Entry, 'qty' | 'reason' | 'note' | 'station_id'>>,
) {
  return query<Entry>(() =>
    supabase.from('waste_entries').update(patch).eq('id', id).select().single(),
  )
}

export function fetchMyEntries(userId: string, since: Date) {
  return query<Entry[]>(() =>
    supabase
      .from('waste_entries')
      .select('*')
      .eq('logged_by', userId)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false }),
  )
}

export const ENTRY_LIMIT = 1000

export function fetchEntries(
  restaurantId: string,
  f: { from: Date; to: Date; reason?: string; stationId?: string; cook?: string },
) {
  return query<Entry[]>(() => {
    let q = supabase
      .from('waste_entries')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('logged_at', f.from.toISOString())
      .lt('logged_at', f.to.toISOString())
    if (f.reason) q = q.eq('reason', f.reason)
    if (f.stationId) q = q.eq('station_id', f.stationId)
    if (f.cook) q = q.eq('logged_by', f.cook)
    return q.order('logged_at', { ascending: false }).limit(ENTRY_LIMIT)
  })
}

// ---------------------------------------------------------------------------
// Photos: <restaurant>/<entry>/{full,thumb} in the private waste-photos bucket
// ---------------------------------------------------------------------------

const BUCKET = 'waste-photos'

export async function uploadPhoto(restaurantId: string, entryId: string, photo: PreparedPhoto) {
  const folder = `${restaurantId}/${entryId}`
  for (const [name, blob] of [
    ['full', photo.full],
    ['thumb', photo.thumb],
  ] as const) {
    await execute(() =>
      supabase.storage
        .from(BUCKET)
        .upload(`${folder}/${name}`, blob, { contentType: photo.type, upsert: true }),
    )
  }
  return folder
}

/** Signed URLs for many photos in one request. Map of folder → url. */
export async function photoUrls(folders: string[], size: 'thumb' | 'full') {
  if (!folders.length) return new Map<string, string>()
  const rows = await query<{ path: string | null; signedUrl: string | null }[]>(() =>
    supabase.storage.from(BUCKET).createSignedUrls(
      folders.map((f) => `${f}/${size}`),
      60 * 60,
    ),
  )
  return new Map(
    rows.flatMap((r) =>
      r.path && r.signedUrl ? [[r.path.replace(`/${size}`, ''), r.signedUrl]] : [],
    ),
  )
}

// ---------------------------------------------------------------------------
// Week, covers, audit
// ---------------------------------------------------------------------------

export function fetchReport(restaurantId: string, weekStart: string) {
  return query<Report>(() =>
    supabase.rpc('weekly_report', { p_restaurant: restaurantId, p_week_start: weekStart }),
  )
}

export function fetchCovers(restaurantId: string, from: string, to: string) {
  return query<Covers[]>(() =>
    supabase
      .from('covers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('day', from)
      .lte('day', to),
  )
}

export function saveCovers(c: Covers) {
  return execute(() => supabase.from('covers').upsert(c))
}

export function fetchAudit(before?: number) {
  return query<AuditRow[]>(() => {
    let q = supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(100)
    if (before) q = q.lt('id', before)
    return q
  })
}
