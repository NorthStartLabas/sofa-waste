-- What the order app needs besides the catalog and history: a basket per
-- person, the function that turns a basket into an order, the midnight
-- sweep, and realtime on baskets and orders. Ported from the order app's own
-- migrations 0002, 0006, 0007 and 0011, plus restaurant_id.

-- The order app adds products without knowing about waste units.
alter table public.items alter column kind set default 'raw';
alter table public.items alter column unit set default 'g';

create table public.basket_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id       uuid not null references public.items (id) on delete cascade,
  quantity      numeric not null default 0,
  added_by      text,
  updated_at    timestamptz not null default now(),
  -- One row per product per person, upserted rather than summed: that is what
  -- lets one person's two phones sync row by row.
  unique (user_id, item_id)
);
create index basket_items_restaurant_idx on public.basket_items (restaurant_id);

alter table public.basket_items enable row level security;
revoke all on public.basket_items from anon;
-- Everyone in the restaurant reads every basket: the "somebody already has
-- this" warning has to name whose basket it is. You write only your own.
create policy basket_read on public.basket_items for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy basket_insert_own on public.basket_items for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.member_rank(restaurant_id)) > 0);
create policy basket_update_own on public.basket_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.member_rank(restaurant_id)) > 0);
create policy basket_delete_own on public.basket_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- Realtime: DELETE events need the whole old row (user_id, item_id), not only
-- the primary key.
alter table public.basket_items replica identity full;
alter publication supabase_realtime add table public.basket_items;
alter publication supabase_realtime add table public.orders;

-- Writes the order, copies your basket into its lines with each product's
-- name and order unit as they are now, and empties your basket, in one call.
-- Invoker: RLS still decides, and it grants nothing extra.
create function public.finish_order(p_restaurant uuid, p_sent_by text default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_order_id uuid;
  v_lines    integer;
begin
  insert into public.orders (restaurant_id, sent_by, user_id)
  values (p_restaurant, nullif(pg_catalog.btrim(p_sent_by), ''), v_user_id)
  returning id into v_order_id;

  insert into public.order_lines (restaurant_id, order_id, item_id, item_name, unit, quantity)
  select p_restaurant, v_order_id, b.item_id, i.name, i.order_unit, b.quantity
  from public.basket_items b
  join public.items i on i.id = b.item_id
  where b.user_id = v_user_id
    and b.restaurant_id = p_restaurant
    and b.quantity > 0;

  get diagnostics v_lines = row_count;
  if v_lines = 0 then
    raise exception 'The basket is empty.';
  end if;

  -- The WHERE is also what safeupdate demands of every delete.
  delete from public.basket_items
  where user_id = v_user_id and restaurant_id = p_restaurant;

  return v_order_id;
end;
$$;
revoke execute on function public.finish_order(uuid, text) from public, anon;
grant execute on function public.finish_order(uuid, text) to authenticated;

-- An unfinished basket does not survive the night. Hourly, with the cutoff
-- worked out in Amsterdam time, so nobody has to move it twice a year.
create function public.clear_stale_baskets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
  v_rows   integer;
begin
  v_cutoff := date_trunc('day', pg_catalog.now() at time zone 'Europe/Amsterdam')
                at time zone 'Europe/Amsterdam';
  delete from public.basket_items where updated_at < v_cutoff;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke execute on function public.clear_stale_baskets() from public, anon, authenticated;

select cron.schedule('clear-stale-baskets', '0 * * * *', 'select public.clear_stale_baskets();');
