-- The order app's basket, order and midnight sweep on the shared database.
-- Rolls back; any failure raises.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'cook1@test.local'),
  ('00000000-0000-0000-0000-00000000c002', 'cook2@test.local');
insert into public.restaurants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Test');
insert into public.members (restaurant_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Anna', 'cook1@test.local', 'cook'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c002', 'Bram', 'cook2@test.local', 'cook');
insert into public.locations (id, restaurant_id, name) values
  ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000000a1', 'Koelcel');
-- No kind or unit: the order app doesn't send them, the defaults fill them in.
insert into public.items (id, restaurant_id, name, order_unit, location_id) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a1', 'Room', 'Doos', '00000000-0000-0000-0000-0000000006a1');

set local role authenticated;

-- Anna and Bram each put room in their own basket.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
insert into public.basket_items (restaurant_id, item_id, quantity, added_by)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000001a1', 2, 'Anna');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated"}', true);
insert into public.basket_items (restaurant_id, item_id, quantity, added_by)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000001a1', 1, 'Bram');

do $$
declare n integer;
begin
  select count(*) into n from public.basket_items;
  assert n = 2, format('Bram should see both baskets for the warning, sees %s', n);
  update public.basket_items set quantity = 99 where added_by = 'Anna';
  get diagnostics n = row_count;
  assert n = 0, 'Bram changed Anna''s basket';
  -- A cook can't touch the catalog.
  update public.items set name = 'x' where id = '00000000-0000-0000-0000-0000000001a1';
  get diagnostics n = row_count;
  assert n = 0, 'a cook renamed a product';
  begin
    insert into public.locations (restaurant_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'x');
    raise exception 'a cook added a location';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anna sends her order.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
select public.finish_order('00000000-0000-0000-0000-0000000000a1', 'Anna');
do $$
declare
  o public.orders;
  l public.order_lines;
  n integer;
begin
  select * into o from public.orders;
  assert o.sent_by = 'Anna' and o.user_id = '00000000-0000-0000-0000-00000000c001', format('order %s', to_jsonb(o));
  select * into l from public.order_lines where order_id = o.id;
  assert l.item_name = 'Room' and l.unit = 'Doos' and l.quantity = 2, format('line %s', to_jsonb(l));
  select count(*) into n from public.basket_items where added_by = 'Anna';
  assert n = 0, 'Anna''s basket was not emptied';
  select count(*) into n from public.basket_items where added_by = 'Bram';
  assert n = 1, 'sending Anna''s order touched Bram''s basket';
end $$;

-- A second send with an empty basket is refused and leaves no order behind.
do $$
declare n integer;
begin
  begin
    perform public.finish_order('00000000-0000-0000-0000-0000000000a1', 'Anna');
    raise exception 'an empty basket was sent';
  exception when raise_exception then
    assert sqlerrm = 'The basket is empty.', sqlerrm;
  end;
  select count(*) into n from public.orders;
  assert n = 1, format('%s orders after refusing an empty basket', n);
end $$;

-- The midnight sweep takes yesterday's basket and leaves today's.
reset role;
insert into public.basket_items (restaurant_id, user_id, item_id, quantity, updated_at)
select '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001',
       '00000000-0000-0000-0000-0000000001a1', 3, now() - interval '2 days';
do $$
declare n integer;
begin
  n := public.clear_stale_baskets();
  assert n = 1, format('swept %s rows, expected yesterday''s one', n);
  assert exists (select 1 from public.basket_items where added_by = 'Bram'), 'swept a basket from today';
end $$;

rollback;
select 'basket_test passed' as result;
