-- Deleting a cook keeps what they logged, under the name they had. Rolls back.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c001', 'cook1@test.local');
insert into public.restaurants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Test');
insert into public.members (restaurant_id, user_id, name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000c001', 'Cook One', 'cook1@test.local', 'cook');
insert into public.items (id, restaurant_id, kind, name, unit, pack_qty, pack_price) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000000a1', 'raw', 'Room', 'ml', 6000, 15);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated"}', true);
insert into public.waste_entries (id, item_id, qty, reason) values
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000001a1', 400, 'expired');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000c001';
do $$
declare e public.waste_entries;
begin
  select * into e from public.waste_entries where id = '00000000-0000-0000-0000-0000000003a1';
  assert found, 'entry vanished with the cook';
  assert e.logged_by is null and e.logged_by_name = 'Cook One' and e.cost = 1, format('entry after delete: %s', to_jsonb(e));
  assert not exists (select 1 from public.members where user_id = '00000000-0000-0000-0000-00000000c001'), 'membership survived';
end $$;
rollback;
select 'delete_user_test passed' as result;
