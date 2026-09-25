import { sql, OLD, NEW, RESTAURANT, wasteUnit } from './lib.mjs'

const read = (q) => sql(OLD, q)
const [locations, suppliers, ingredients, dishes, dishLinks, orders, lines] = await Promise.all([
  read('select id, name, sort_order from locations'),
  read('select id, name from suppliers'),
  read(
    'select id, name, unit, location_id, supplier_id, sort_order, archived, photo_path from ingredients',
  ),
  read('select id, name from dishes'),
  read('select dish_id, ingredient_id from dish_ingredients'),
  read('select id, sent_at, sent_by from orders'),
  read('select id, order_id, ingredient_id, quantity, ingredient_name, unit from order_lines'),
])
const items = ingredients.map((i) => ({ ...i, waste_unit: wasteUnit(i.unit, i.name) }))

const lit = (rows) => {
  const json = JSON.stringify(rows)
  if (json.includes('$copy$')) throw new Error('data contains the quote tag')
  return `$copy$${json}$copy$`
}

// One transaction: all of it lands, or none of it. The route trigger is held
// off so sort_order keeps the order app's values instead of being recomputed,
// and the audit triggers so an import doesn't read as 300 edits.
const script = `
begin;
alter table public.items disable trigger items_route_place;
alter table public.items disable trigger items_audit;
alter table public.locations disable trigger locations_audit;

insert into public.locations (id, restaurant_id, name, sort_order)
select id, '${RESTAURANT}', name, sort_order from json_to_recordset(${lit(locations)}) as x(id uuid, name text, sort_order int)
on conflict (id) do nothing;

insert into public.suppliers (id, restaurant_id, name)
select id, '${RESTAURANT}', name from json_to_recordset(${lit(suppliers)}) as x(id uuid, name text)
on conflict (id) do nothing;

insert into public.items (id, restaurant_id, kind, name, unit, order_unit, location_id, supplier_id, sort_order, archived, photo_path)
select id, '${RESTAURANT}', 'raw', name, waste_unit, nullif(btrim(unit), ''), location_id, supplier_id, sort_order, archived, photo_path
from json_to_recordset(${lit(items)}) as x(id uuid, name text, unit text, waste_unit text, location_id uuid, supplier_id uuid, sort_order int, archived boolean, photo_path text)
on conflict (id) do nothing;

insert into public.dishes (id, restaurant_id, name)
select id, '${RESTAURANT}', name from json_to_recordset(${lit(dishes)}) as x(id uuid, name text)
on conflict (id) do nothing;

insert into public.dish_items (restaurant_id, dish_id, item_id)
select '${RESTAURANT}', dish_id, ingredient_id from json_to_recordset(${lit(dishLinks)}) as x(dish_id uuid, ingredient_id uuid)
on conflict do nothing;

insert into public.orders (id, restaurant_id, sent_at, sent_by, user_id)
select id, '${RESTAURANT}', sent_at, sent_by, null from json_to_recordset(${lit(orders)}) as x(id uuid, sent_at timestamptz, sent_by text)
on conflict (id) do nothing;

insert into public.order_lines (id, restaurant_id, order_id, item_id, quantity, item_name, unit)
select id, '${RESTAURANT}', order_id, ingredient_id, quantity, ingredient_name, unit
from json_to_recordset(${lit(lines)}) as x(id uuid, order_id uuid, ingredient_id uuid, quantity numeric, ingredient_name text, unit text)
on conflict (id) do nothing;

alter table public.items enable trigger items_route_place;
alter table public.items enable trigger items_audit;
alter table public.locations enable trigger locations_audit;
commit;
`
await sql(NEW, script)
const [check] = await sql(
  NEW,
  `select
  (select count(*) from locations) locations, (select count(*) from suppliers) suppliers, (select count(*) from items where kind = 'raw') items,
  (select count(*) from items where photo_path is not null) with_photo, (select count(*) from dishes) dishes, (select count(*) from dish_items) dish_links,
  (select count(*) from orders) orders, (select count(*) from order_lines) order_lines, (select count(*) from order_lines where item_id is not null) lines_linked`,
)
console.log(
  'source:',
  JSON.stringify({
    locations: locations.length,
    suppliers: suppliers.length,
    items: items.length,
    with_photo: items.filter((i) => i.photo_path).length,
    dishes: dishes.length,
    dish_links: dishLinks.length,
    orders: orders.length,
    order_lines: lines.length,
    lines_linked: lines.filter((l) => l.ingredient_id).length,
  }),
)
console.log('copied:', JSON.stringify(check))
