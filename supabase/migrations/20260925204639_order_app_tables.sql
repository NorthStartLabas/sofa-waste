-- The order app's dishes and order history, ready for when that app moves onto
-- this database. Same shape as there, plus restaurant_id like every table here.
-- This app doesn't read them.

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null
);

-- Which raw products go into a dish. The order app calls this dish_ingredients.
create table public.dish_items (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  dish_id       uuid not null references public.dishes (id) on delete cascade,
  item_id       uuid not null references public.items (id) on delete cascade,
  primary key (dish_id, item_id)
);
create index dish_items_item_idx on public.dish_items (item_id);

-- An order as it was sent. Append-only, as in the order app: history is the
-- only record of what actually went out.
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sent_at       timestamptz not null default now(),
  -- Name at the time of sending. Accounts from before the move don't exist
  -- here, so their orders carry only this.
  sent_by       text,
  user_id       uuid default auth.uid() references auth.users (id) on delete set null
);
create index orders_restaurant_sent_idx on public.orders (restaurant_id, sent_at desc);

create table public.order_lines (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id      uuid not null references public.orders (id) on delete cascade,
  -- Null once the product is deleted; the line keeps its own name and unit.
  item_id       uuid references public.items (id) on delete set null,
  quantity      numeric not null,
  item_name     text not null,
  unit          text
);
create index order_lines_order_idx on public.order_lines (order_id);
create index order_lines_item_idx on public.order_lines (item_id);

alter table public.dishes enable row level security;
alter table public.dish_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
revoke all on public.dishes, public.dish_items, public.orders, public.order_lines from anon;

create policy dishes_read on public.dishes for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy dishes_write on public.dishes for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);
create policy dish_items_read on public.dish_items for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy dish_items_write on public.dish_items for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

-- Everyone in the restaurant reads the history; you add your own orders; no
-- one updates or deletes (no policy means denied).
create policy orders_read on public.orders for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy orders_insert_own on public.orders for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.member_rank(restaurant_id)) > 0);
create policy order_lines_read on public.order_lines for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy order_lines_insert_own on public.order_lines for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = (select auth.uid()) and o.restaurant_id = order_lines.restaurant_id));
