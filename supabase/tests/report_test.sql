-- weekly_report on a fixed week. Rolls back; any failure raises.
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c001', 'cook1@test.local');
insert into public.restaurants (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Test');
insert into public.stations (id, restaurant_id, name) values
  ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000a1', 'garde');
insert into public.covers (restaurant_id, day, lunch, dinner) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-14', 20, 30),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-15', 0, 50),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-21', 99, 99); -- next week, ignored

-- Fixture rows go in under the trigger, which would stamp them with now().
alter table public.waste_entries disable trigger waste_entries_fill;
insert into public.waste_entries
  (restaurant_id, item_name, unit, unit_cost, cost, qty, reason, station_id, logged_by, logged_by_name, logged_at)
select '00000000-0000-0000-0000-0000000000a1', v.name, 'g', v.cost / 100, v.cost, 100, v.reason,
       '00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000c001', 'Cook', v.at::timestamptz
from (values
  ('Anijsboter', 10, 'made_too_much', '2026-09-14 12:00+02'),
  ('Anijsboter', 10, 'made_too_much', '2026-09-15 12:00+02'),
  ('Anijsboter', 10, 'made_too_much', '2026-09-16 12:00+02'),
  ('Room',        5, 'expired',       '2026-09-14 09:00+02'),
  ('Room',        5, 'expired',       '2026-09-14 18:00+02'),
  ('Olie',     null, 'spoiled',       '2026-09-17 12:00+02'),
  -- 00:30 on Monday in Maastricht is still Sunday in UTC: belongs to this week.
  ('Vis',         1, 'dropped',       '2026-09-13 22:30+00'),
  -- 23:30 on Sunday in Maastricht is last week.
  ('Anijsboter',  4, 'made_too_much', '2026-09-13 23:30+02'),
  -- Next Monday: not this week, not last week.
  ('Room',       50, 'expired',       '2026-09-21 12:00+02')
) as v (name, cost, reason, at);
alter table public.waste_entries enable trigger waste_entries_fill;

do $$
declare
  r jsonb := public.weekly_report('00000000-0000-0000-0000-0000000000a1', '2026-09-14');
begin
  assert (r ->> 'total')::numeric = 41, format('total %s', r ->> 'total');
  assert (r ->> 'prev_total')::numeric = 4, format('prev_total %s', r ->> 'prev_total');
  assert (r ->> 'entries')::int = 7, format('entries %s', r ->> 'entries');
  assert (r ->> 'covers')::int = 100, format('covers %s', r ->> 'covers');
  assert (r ->> 'per_cover')::numeric = 0.41, format('per_cover %s', r ->> 'per_cover');
  assert jsonb_array_length(r -> 'repeated') = 1
     and r -> 'repeated' -> 0 ->> 'name' = 'Anijsboter'
     and (r -> 'repeated' -> 0 ->> 'days')::int = 3, format('repeated %s', r -> 'repeated');
  assert r -> 'top_items' -> 0 ->> 'name' = 'Anijsboter', format('top %s', r -> 'top_items');
  assert jsonb_array_length(r -> 'top_items') = 3, 'incomplete item must not be in the top list';
  assert r -> 'incomplete' -> 0 ->> 'name' = 'Olie', format('incomplete %s', r -> 'incomplete');
  assert r -> 'by_reason' -> 0 ->> 'reason' = 'made_too_much'
     and (r -> 'by_reason' -> 0 ->> 'total')::numeric = 30, format('by_reason %s', r -> 'by_reason');
  assert r -> 'by_station' -> 0 ->> 'station' = 'garde', format('by_station %s', r -> 'by_station');
end $$;

rollback;
select 'report_test passed' as result;
