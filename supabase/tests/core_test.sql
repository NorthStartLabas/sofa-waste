-- Cost math, snapshots, cycle guard and the entry permissions.
-- Runs inside a transaction that rolls back, so it is safe on any database:
--   supabase db execute --file supabase/tests/core_test.sql   (local)
-- or paste into the SQL editor. Any failure raises; silence is a pass.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'cook1@test.local'),
  ('00000000-0000-0000-0000-00000000c002', 'cook2@test.local'),
  ('00000000-0000-0000-0000-00000000c003', 'chef@test.local');
insert into public.restaurants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Test');
insert into public.locations (id, restaurant_id, name) values
  ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000000a1', 'Koelcel'),
  ('00000000-0000-0000-0000-0000000006a2', '00000000-0000-0000-0000-0000000000a1', 'Droog');
insert into public.members (restaurant_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Cook One', 'cook1@test.local', 'cook'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c002', 'Cook Two', 'cook2@test.local', 'cook'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c003', 'Chef', 'chef@test.local', 'chef');

-- cream: box of 6 x 1 L at 15 euro -> 2.50/L
-- fish: 30 euro/kg, 60% yield when cleaned
-- butter 250 g at 3 euro, bloemkool 1.20 a head, anise 100 g at 8 euro
insert into public.items (id, restaurant_id, kind, name, unit, pack_qty, pack_price, yield_pct, location_id) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Room', 'ml', 6000, 15, null, '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Dagvis', 'g', 1000, 30, 60, '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000001a3', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Boter', 'g', 250, 3, null, '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000001a4', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Bloemkool', 'pcs', 1, 1.20, null, '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000001a5', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Anijs', 'g', 100, 8, null, '00000000-0000-0000-0000-0000000006a1'),
  ('00000000-0000-0000-0000-0000000001a6', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Olie zonder prijs', 'ml', 1000, null, null, '00000000-0000-0000-0000-0000000006a1');
insert into public.items (id, restaurant_id, kind, name, unit, batch_qty) values
  -- anijsboter: 300 g butter (3.60) + 80 g anise (6.40) = 10.00 for 350 g
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000000a1', 'prep', 'Anijsboter', 'g', 350),
  -- roosjes: 4 bloemkool (4.80) + 100 g anijsboter (2.857142...) for 1000 g
  ('00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000000a1', 'prep', 'Bloemkoolroosjes met anijsboter', 'g', 1000),
  ('00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-0000000000a1', 'prep', 'Saus zonder gewicht', 'ml', null);
insert into public.recipe_lines (restaurant_id, prep_item_id, ingredient_item_id, qty) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000001a3', 300),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000001a5', 80),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000001a4', 4),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000002a1', 100),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-0000000001a1', 500);

do $$
declare
  c numeric;
begin
  c := public.item_unit_cost('00000000-0000-0000-0000-0000000001a1');
  assert c = 0.0025, format('cream per ml: %s', c);
  c := public.item_unit_cost('00000000-0000-0000-0000-0000000001a2', true);
  assert c = 0.05, format('cleaned fish per g: %s', c);
  c := public.item_unit_cost('00000000-0000-0000-0000-0000000001a2', false);
  assert c = 0.03, format('raw fish per g: %s', c);
  c := public.item_unit_cost('00000000-0000-0000-0000-0000000002a1');
  assert round(c * 350, 6) = 10, format('anijsboter batch: %s', c * 350);
  c := public.item_unit_cost('00000000-0000-0000-0000-0000000002a2');
  assert round(c * 1000, 4) = round(4.80 + 100 * 10 / 350.0, 4), format('roosjes batch: %s', c * 1000);
  assert public.item_unit_cost('00000000-0000-0000-0000-0000000001a6') is null, 'missing price must be null';
  assert public.item_unit_cost('00000000-0000-0000-0000-0000000002a3') is null, 'missing batch weight must be null';
end $$;

-- Route fields: a raw product needs a location and joins the end of its
-- route; a component needs neither.
do $$
declare
  orders integer[];
begin
  select array_agg(sort_order order by id) into orders from public.items
  where location_id = '00000000-0000-0000-0000-0000000006a1';
  assert orders = array[0, 1, 2, 3, 4, 5], format('route order %s', orders);

  begin
    insert into public.items (restaurant_id, kind, name, unit)
    values ('00000000-0000-0000-0000-0000000000a1', 'raw', 'Zonder locatie', 'g');
    raise exception 'raw product without a location was accepted';
  exception when check_violation then null;
  end;

  update public.items set location_id = '00000000-0000-0000-0000-0000000006a2'
  where id = '00000000-0000-0000-0000-0000000001a1';
  update public.items set location_id = '00000000-0000-0000-0000-0000000006a2'
  where id = '00000000-0000-0000-0000-0000000001a2';
  select array_agg(sort_order order by id) into orders from public.items
  where location_id = '00000000-0000-0000-0000-0000000006a2';
  assert orders = array[0, 1], format('moved products should queue up in the new location: %s', orders);
end $$;

-- A component can never contain itself.
do $$
begin
  insert into public.recipe_lines (restaurant_id, prep_item_id, ingredient_item_id, qty) values
    ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002a2', 10);
  raise exception 'cycle was accepted';
exception when others then
  assert sqlerrm = 'recipe_cycle', format('unexpected error: %s', sqlerrm);
end $$;

-- As cook one: log 100 g of cleaned fish. The client-sent cost is ignored.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);

insert into public.waste_entries (id, restaurant_id, item_id, qty, cleaned, reason, cost, item_name, unit, logged_by, logged_by_name)
values ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-0000000001a2', 100, true, 'spoiled', 0.01, 'fake', 'x',
        '00000000-0000-0000-0000-00000000c002', 'fake');
insert into public.waste_entries (id, restaurant_id, item_id, qty, reason)
values ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-0000000001a6', 50, 'expired');

do $$
declare
  e public.waste_entries;
begin
  select * into e from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1';
  assert e.cost = 5, format('100 g cleaned fish should cost 5.00, got %s', e.cost);
  assert e.item_name = 'Dagvis' and e.unit = 'g', 'snapshot not taken from item';
  assert e.logged_by = '00000000-0000-0000-0000-00000000c001', 'logged_by was forgeable';
  assert e.logged_by_name = 'Cook One', 'logged_by_name was forgeable';
  select * into e from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a2';
  assert e.cost is null and e.unit_cost is null, 'missing price must log as incomplete, not 0';
end $$;

-- Cook two sees none of cook one's entries and cannot delete them.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}', true);
do $$
declare
  n integer;
begin
  select count(*) into n from public.waste_entries;
  assert n = 0, format('cook two sees %s foreign entries', n);
  delete from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1';
  get diagnostics n = row_count;
  assert n = 0, 'cook two deleted cook one''s entry';
  select count(*) into n from public.audit_log;
  assert n = 0, 'a cook can read the audit log';
end $$;

-- The chef reprices fish and edits the qty. The entry keeps its logged price.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c003","role":"authenticated"}', true);
update public.items set pack_price = 60 where id = '00000000-0000-0000-0000-0000000001a2';
update public.waste_entries set qty = 200, unit_cost = 99, logged_by = '00000000-0000-0000-0000-00000000c003' where id = '00000000-0000-0000-0000-0000000003a1';
do $$
declare
  e public.waste_entries;
begin
  select * into e from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1';
  assert e.cost = 10, format('200 g at the logged 0.05/g should be 10.00, got %s', e.cost);
  assert e.logged_by = '00000000-0000-0000-0000-00000000c001', 'chef reassigned an entry';
end $$;

-- Cook one can take an entry back within 10 minutes, not after.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
delete from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a2';
reset role;
do $$ begin
  assert not exists (select 1 from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a2'),
    'cook could not undo a fresh entry';
end $$;
-- The fill trigger pins logged_at on update; move it underneath the trigger.
alter table public.waste_entries disable trigger waste_entries_fill;
update public.waste_entries set logged_at = now() - interval '11 minutes'
where id = '00000000-0000-0000-0000-0000000003a1';
alter table public.waste_entries enable trigger waste_entries_fill;
set local role authenticated;
delete from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1';
reset role;
do $$
begin
  assert exists (select 1 from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1'),
    'cook deleted an entry after 10 minutes';
  assert exists (select 1 from public.audit_log
                 where table_name = 'waste_entries' and action = 'update'
                   and actor = '00000000-0000-0000-0000-00000000c003'),
    'chef edit not audited';
end $$;

rollback;
select 'core_test passed' as result;
