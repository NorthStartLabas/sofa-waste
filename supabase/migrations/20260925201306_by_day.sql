-- Waste per day of the week, for the Monday email's day chart.
create or replace function public.weekly_report(p_restaurant uuid, p_week_start date)
returns jsonb
language sql stable set search_path = ''
as $$
  with r as (
    select timezone from public.restaurants where id = p_restaurant
  ),
  e as (
    select w.*, (w.logged_at at time zone r.timezone)::date as day,
           coalesce(w.item_id::text, w.item_name) as item_key
    from public.waste_entries w, r
    where w.restaurant_id = p_restaurant
      and w.logged_at >= ((p_week_start - 7)::timestamp at time zone r.timezone)
      and w.logged_at < ((p_week_start + 7)::timestamp at time zone r.timezone)
  ),
  cur as (select * from e where day >= p_week_start),
  prev as (select * from e where day < p_week_start),
  cov as (
    select coalesce(sum(lunch + dinner), 0) as n
    from public.covers
    where restaurant_id = p_restaurant and day >= p_week_start and day < p_week_start + 7
  ),
  items as (
    select item_key, min(item_name) as name, min(unit) as unit,
           sum(qty) as qty, sum(cost) as total, count(*) as entries,
           count(distinct day) as days, count(*) filter (where cost is null) as incomplete
    from cur group by item_key
  )
  select jsonb_build_object(
    'week_start', p_week_start,
    'total', (select coalesce(sum(cost), 0) from cur),
    'prev_total', (select coalesce(sum(cost), 0) from prev),
    'entries', (select count(*) from cur),
    'incomplete_entries', (select count(*) from cur where cost is null),
    'covers', (select n from cov),
    'per_cover', (select case when cov.n > 0 then (select coalesce(sum(cost), 0) from cur) / cov.n end from cov),
    -- Monday to Sunday, zero days included, so the email can draw the week.
    'by_day', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'total', coalesce(x.total, 0), 'entries', coalesce(x.n, 0)) order by d)
      from generate_series(p_week_start::timestamp, (p_week_start + 6)::timestamp, interval '1 day') d
      left join (select day, sum(cost) as total, count(*) as n from cur group by day) x on x.day = d::date),
    'by_reason', coalesce((
      select jsonb_agg(jsonb_build_object('reason', reason, 'total', total, 'entries', n) order by total desc nulls last)
      from (select reason, sum(cost) as total, count(*) as n from cur group by reason) x), '[]'),
    'by_station', coalesce((
      select jsonb_agg(jsonb_build_object('station', station, 'total', total, 'entries', n) order by total desc nulls last)
      from (select s.name as station, sum(cur.cost) as total, count(*) as n
            from cur left join public.stations s on s.id = cur.station_id
            group by 1) x), '[]'),
    'top_items', coalesce((
      select jsonb_agg(to_jsonb(t) - 'item_key' order by t.total desc)
      from (select * from items where total > 0 order by total desc limit 10) t), '[]'),
    -- Thrown on three or more days of the week: usually a batch that is too big.
    'repeated', coalesce((
      select jsonb_agg(to_jsonb(t) - 'item_key' order by t.days desc, t.total desc nulls last)
      from (select * from items where days >= 3) t), '[]'),
    'incomplete', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'entries', incomplete) order by name)
      from items where incomplete > 0), '[]')
  )
$$;
