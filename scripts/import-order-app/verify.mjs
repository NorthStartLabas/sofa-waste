import { createHash } from 'node:crypto'
import { sql, OLD, NEW } from './lib.mjs'
const [old] = await sql(
  OLD,
  `select (select count(*) from locations) locations, (select count(*) from suppliers) suppliers, (select count(*) from ingredients) ingredients,
  (select count(*) from dishes) dishes, (select count(*) from dish_ingredients) dish_links, (select count(*) from orders) orders, (select count(*) from order_lines) order_lines`,
)
console.log('order app now:', JSON.stringify(old))
const [objs] = await sql(
  NEW,
  `select count(*) as n from storage.objects where bucket_id = 'ingredient-photos'`,
)
console.log('photo objects here:', objs.n)
// Same bytes on both sides, for a handful of photos.
const sample = await sql(
  NEW,
  `select photo_path from items where photo_path is not null order by random() limit 6`,
)
const hash = async (ref, p) =>
  createHash('sha256')
    .update(
      Buffer.from(
        await (
          await fetch(`https://${ref}.supabase.co/storage/v1/object/public/ingredient-photos/${p}`)
        ).arrayBuffer(),
      ),
    )
    .digest('hex')
let same = 0
for (const { photo_path } of sample)
  for (const s of ['full', 'thumb'])
    if ((await hash(OLD, `${photo_path}/${s}`)) === (await hash(NEW, `${photo_path}/${s}`))) same++
console.log(`identical bytes: ${same}/${sample.length * 2}`)
// Field-by-field on the catalog: every ingredient's name, order unit, location, supplier, route position, photo.
const a = await sql(
  OLD,
  `select id, name, unit, location_id, supplier_id, sort_order, archived, photo_path from ingredients`,
)
const b = await sql(
  NEW,
  `select id, name, order_unit as unit, location_id, supplier_id, sort_order, archived, photo_path from items where kind = 'raw'`,
)
const byId = new Map(b.map((r) => [r.id, r]))
const diffs = a.filter(
  (r) => JSON.stringify({ ...r, unit: r.unit?.trim() || null }) !== JSON.stringify(byId.get(r.id)),
)
console.log('catalog rows that differ:', diffs.length, diffs.slice(0, 2))
const ol = await sql(
  OLD,
  `select md5(string_agg(id::text || quantity || ingredient_name || coalesce(unit,'') || coalesce(ingredient_id::text,''), ',' order by id)) h from order_lines`,
)
const nl = await sql(
  NEW,
  `select md5(string_agg(id::text || quantity || item_name || coalesce(unit,'') || coalesce(item_id::text,''), ',' order by id)) h from order_lines`,
)
console.log('order lines identical:', ol[0].h === nl[0].h)
