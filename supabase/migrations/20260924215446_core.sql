-- Core schema for the shared SOFAMaastricht database.
--
-- Shared tables (restaurants, members, stations, suppliers, items) are meant to
-- be used by every kitchen app on this project; sofa-inventory moves onto them
-- later. Every row carries restaurant_id so a second restaurant is a row, not a
-- rebuild.

-- ---------------------------------------------------------------------------
-- Tenancy and people
-- ---------------------------------------------------------------------------

create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- The weekly report and "which day was it" on the server use this. The
  -- phone answers that question itself everywhere else.
  timezone      text not null default 'Europe/Amsterdam',
  report_emails text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Platform managers (Liviu): read the audit log. Not a restaurant role, so a
-- restaurant's own admin can never grant it.
create table public.app_managers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.members (
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (btrim(name) <> ''),
  email           text not null,
  role            text not null check (role in ('cook', 'chef', 'admin')),
  -- Set on creation and on a PIN reset; cleared by the set-pin function.
  must_change_pin boolean not null default true,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);
create index members_user_idx on public.members (user_id);
create unique index members_email_idx on public.members (restaurant_id, lower(email));

-- 0 = not a member, 1 cook, 2 chef, 3 admin. Definer so policies on members
-- itself don't recurse; returns only the caller's own rank.
create function public.member_rank(p_restaurant uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case role when 'cook' then 1 when 'chef' then 2 when 'admin' then 3 end
    from public.members
    where restaurant_id = p_restaurant and user_id = auth.uid() and active
  ), 0)
$$;

create function public.is_app_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.app_managers where user_id = auth.uid())
$$;

-- Definer functions in public are served at /rest/v1/rpc to anyone holding the
-- anon key unless execute is taken away. Policies run as the caller, so
-- authenticated keeps it.
revoke execute on function public.member_rank(uuid) from public, anon;
revoke execute on function public.is_app_manager() from public, anon;
grant execute on function public.member_rank(uuid) to authenticated;
grant execute on function public.is_app_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.stations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (btrim(name) <> ''),
  sort_order    integer not null default 0
);

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (btrim(name) <> '')
);

-- Raw products and prepped components in one table, so a recipe line can point
-- at either and a component can contain a component.
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind          text not null check (kind in ('raw', 'prep')),
  name          text not null check (btrim(name) <> ''),
  -- The unit waste is weighed or counted in. Everything else is in this unit.
  unit          text not null check (unit in ('g', 'ml', 'pcs')),
  station_id    uuid references public.stations (id) on delete set null,
  supplier_id   uuid references public.suppliers (id) on delete set null,
  -- raw: what one purchase unit holds, in `unit` (box of 6 x 1 L = 6000 ml)
  pack_qty      numeric check (pack_qty > 0),
  -- raw: what one purchase unit costs, ex VAT
  pack_price    numeric check (pack_price >= 0),
  -- raw: % usable after cleaning. Null = this product is never logged cleaned.
  yield_pct     numeric check (yield_pct > 0 and yield_pct <= 100),
  -- prep: weight (or volume, or count) of one finished batch, in `unit`
  batch_qty     numeric check (batch_qty > 0),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  check (kind = 'raw' or (pack_qty is null and pack_price is null and yield_pct is null)),
  check (kind = 'prep' or batch_qty is null)
);
create index items_restaurant_idx on public.items (restaurant_id, name);

-- One batch of a prepped component, in quantities as bought.
create table public.recipe_lines (
  id                 uuid primary key default gen_random_uuid(),
  -- Filled by the trigger from the component; the client's value is ignored.
  restaurant_id      uuid not null references public.restaurants (id) on delete cascade,
  prep_item_id       uuid not null references public.items (id) on delete cascade,
  -- restrict: deleting a product that a recipe uses would silently change that
  -- recipe's cost. Archive it, or take it out of the recipe first.
  ingredient_item_id uuid not null references public.items (id) on delete restrict,
  qty                numeric not null check (qty > 0),
  unique (prep_item_id, ingredient_item_id)
);
create index recipe_lines_ingredient_idx on public.recipe_lines (ingredient_item_id);

create function public.recipe_line_guard()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_prep public.items;
  v_ingredient public.items;
begin
  select * into v_prep from public.items where id = new.prep_item_id;
  select * into v_ingredient from public.items where id = new.ingredient_item_id;
  if v_prep.kind is distinct from 'prep' then
    raise exception 'Only a prepped component has a recipe' using errcode = 'P0001';
  end if;
  if v_ingredient.restaurant_id is distinct from v_prep.restaurant_id then
    raise exception 'Ingredient belongs to another restaurant' using errcode = 'P0001';
  end if;
  new.restaurant_id := v_prep.restaurant_id;

  -- A component may contain components, but never itself, however deep.
  if exists (
    with recursive down (id) as (
      select new.ingredient_item_id
      union
      select rl.ingredient_item_id
      from public.recipe_lines rl
      join down on rl.prep_item_id = down.id
    )
    select 1 from down where id = new.prep_item_id
  ) then
    raise exception 'recipe_cycle' using errcode = 'P0001',
      hint = 'This component already goes into the ingredient you picked.';
  end if;
  return new;
end;
$$;

create trigger recipe_lines_guard
before insert or update on public.recipe_lines
for each row execute function public.recipe_line_guard();

-- Cost per unit (per g / ml / piece), ex VAT. Null means "incomplete": a price,
-- pack size, yield, batch weight or recipe line is missing somewhere down the
-- tree. Never 0 for missing.
--
-- raw:     pack_price / pack_qty, divided by yield when logged cleaned
-- prep:    sum(line qty x ingredient cost as bought) / finished batch weight,
--          which prices trimming and cooking loss in automatically
create function public.item_unit_cost(p_item uuid, p_cleaned boolean default false, p_depth integer default 0)
returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v public.items;
  v_line record;
  v_cost numeric;
  v_total numeric := 0;
  v_lines integer := 0;
begin
  -- The trigger stops cycles; this stops a runaway if one ever got in anyway.
  if p_depth > 12 then return null; end if;
  select * into v from public.items where id = p_item;
  if not found then return null; end if;

  if v.kind = 'raw' then
    if v.pack_price is null or v.pack_qty is null then return null; end if;
    if not p_cleaned then return v.pack_price / v.pack_qty; end if;
    if v.yield_pct is null then return null; end if;
    return v.pack_price / v.pack_qty / (v.yield_pct / 100);
  end if;

  if v.batch_qty is null then return null; end if;
  for v_line in
    select ingredient_item_id, qty from public.recipe_lines where prep_item_id = p_item
  loop
    v_cost := public.item_unit_cost(v_line.ingredient_item_id, false, p_depth + 1);
    if v_cost is null then return null; end if;
    v_total := v_total + v_line.qty * v_cost;
    v_lines := v_lines + 1;
  end loop;
  if v_lines = 0 then return null; end if;
  return v_total / v.batch_qty;
end;
$$;

-- What the catalog screens read: every item with its live cost.
create view public.items_with_cost
with (security_invoker = true)
as
select
  i.*,
  public.item_unit_cost(i.id, false) as unit_cost,
  case when i.yield_pct is not null then public.item_unit_cost(i.id, true) end as cleaned_unit_cost
from public.items i;

-- ---------------------------------------------------------------------------
-- Waste entries
-- ---------------------------------------------------------------------------

create table public.waste_entries (
  -- Made on the device, so the photo can be uploaded under it before the row exists.
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  item_id        uuid references public.items (id) on delete set null,
  -- Snapshots, written by the trigger at logging time. Renaming or repricing an
  -- item must never rewrite what past weeks cost.
  item_name      text not null,
  unit           text not null,
  unit_cost      numeric,
  cost           numeric,
  qty            numeric not null check (qty > 0),
  cleaned        boolean not null default false,
  reason         text not null check (reason in
                   ('made_too_much', 'expired', 'spoiled', 'mistake', 'dropped', 'supplier_quality', 'other')),
  note           text,
  station_id     uuid references public.stations (id) on delete set null,
  photo_path     text,
  logged_by      uuid not null references auth.users (id),
  logged_by_name text not null,
  logged_at      timestamptz not null default now(),
  check (reason <> 'other' or btrim(coalesce(note, '')) <> '')
);
create index waste_entries_restaurant_at_idx on public.waste_entries (restaurant_id, logged_at desc);
create index waste_entries_logged_by_idx on public.waste_entries (logged_by, logged_at desc);
create index waste_entries_item_idx on public.waste_entries (item_id);

-- Everything that decides money or identity is set here, not by the client.
create function public.waste_entry_fill()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_item public.items;
begin
  if tg_op = 'INSERT' then
    select * into v_item from public.items where id = new.item_id;
    if not found then
      raise exception 'Unknown item' using errcode = 'P0001';
    end if;
    new.restaurant_id := v_item.restaurant_id;
    new.item_name := v_item.name;
    new.unit := v_item.unit;
    new.cleaned := new.cleaned and v_item.yield_pct is not null;
    new.unit_cost := public.item_unit_cost(v_item.id, new.cleaned);
    new.logged_by := auth.uid();
    new.logged_at := now();
    new.logged_by_name := coalesce(
      (select name from public.members
       where restaurant_id = v_item.restaurant_id and user_id = auth.uid()),
      '?');
    if new.station_id is null then new.station_id := v_item.station_id; end if;
  else
    -- An edit can change what was thrown and why, never who, when, what or at
    -- which price.
    new.id := old.id;
    new.restaurant_id := old.restaurant_id;
    new.item_id := old.item_id;
    new.item_name := old.item_name;
    new.unit := old.unit;
    new.cleaned := old.cleaned;
    new.unit_cost := old.unit_cost;
    new.logged_by := old.logged_by;
    new.logged_by_name := old.logged_by_name;
    new.logged_at := old.logged_at;
  end if;
  new.cost := round(new.unit_cost * new.qty, 4);
  return new;
end;
$$;

create trigger waste_entries_fill
before insert or update on public.waste_entries
for each row execute function public.waste_entry_fill();

-- ---------------------------------------------------------------------------
-- Covers
-- ---------------------------------------------------------------------------

create table public.covers (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day           date not null,
  lunch         integer not null default 0 check (lunch >= 0),
  dinner        integer not null default 0 check (dinner >= 0),
  primary key (restaurant_id, day)
);

-- ---------------------------------------------------------------------------
-- Audit log: who changed what. Readable by app managers only.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id            bigint generated always as identity primary key,
  restaurant_id uuid,
  table_name    text not null,
  row_id        text,
  action        text not null,
  old_row       jsonb,
  new_row       jsonb,
  actor         uuid default auth.uid(),
  at            timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

-- Definer: the log has no insert policy, so only this function can write it.
create function public.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into public.audit_log (restaurant_id, table_name, row_id, action, old_row, new_row)
  values (
    (v_row ->> 'restaurant_id')::uuid,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'day'),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

-- Entries are their own record of being made; only changes to them are logged.
create trigger waste_entries_audit after update or delete on public.waste_entries
for each row execute function public.audit_row();
create trigger items_audit after insert or update or delete on public.items
for each row execute function public.audit_row();
create trigger recipe_lines_audit after insert or update or delete on public.recipe_lines
for each row execute function public.audit_row();
create trigger members_audit after insert or update or delete on public.members
for each row execute function public.audit_row();
create trigger covers_audit after insert or update or delete on public.covers
for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- PIN lockout. Only the pin-login edge function (service role) touches this.
-- ---------------------------------------------------------------------------

create table public.pin_attempts (
  key          text primary key,           -- 'email:x@y' or 'ip:1.2.3.4'
  failed_count integer not null default 0,
  lockouts     integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- Claims one attempt before the PIN is checked, under a row lock, so a burst of
-- parallel guesses can't all slip in before the first failure is counted.
-- Returns null to go ahead, or the time the lock ends. Each lockout doubles,
-- 15 min up to a day. A quiet hour forgets old slips.
create function public.pin_attempt(p_key text, p_max integer)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v public.pin_attempts;
begin
  insert into public.pin_attempts (key) values (p_key) on conflict (key) do nothing;
  select * into v from public.pin_attempts where key = p_key for update;
  if v.locked_until > now() then return v.locked_until; end if;
  if v.updated_at < now() - interval '1 hour' then v.failed_count := 0; end if;
  if v.failed_count >= p_max then
    update public.pin_attempts
    set locked_until = now() + least(interval '15 minutes' * power(2, lockouts), interval '24 hours'),
        lockouts = lockouts + 1,
        failed_count = 0,
        updated_at = now()
    where key = p_key
    returning locked_until into v.locked_until;
    return v.locked_until;
  end if;
  update public.pin_attempts
  set failed_count = v.failed_count + 1, updated_at = now()
  where key = p_key;
  return null;
end;
$$;

create function public.pin_attempt_ok(p_key text)
returns void
language sql security definer set search_path = ''
as $$
  update public.pin_attempts
  set failed_count = 0, lockouts = 0, locked_until = null, updated_at = now()
  where key = p_key
$$;

revoke execute on function public.pin_attempt(text, integer) from public, anon, authenticated;
revoke execute on function public.pin_attempt_ok(text) from public, anon, authenticated;
grant execute on function public.pin_attempt(text, integer) to service_role;
grant execute on function public.pin_attempt_ok(text) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.restaurants enable row level security;
alter table public.app_managers enable row level security;
alter table public.members enable row level security;
alter table public.stations enable row level security;
alter table public.suppliers enable row level security;
alter table public.items enable row level security;
alter table public.recipe_lines enable row level security;
alter table public.waste_entries enable row level security;
alter table public.covers enable row level security;
alter table public.audit_log enable row level security;
alter table public.pin_attempts enable row level security; -- no policies: service role only

-- Nothing here is for signed-out visitors. RLS already says no; this says it twice.
revoke all on all tables in schema public from anon;

create policy restaurants_read on public.restaurants for select to authenticated
  using ((select public.member_rank(id)) > 0 or (select public.is_app_manager()));
create policy restaurants_admin on public.restaurants for update to authenticated
  using ((select public.member_rank(id)) = 3);

create policy app_managers_self on public.app_managers for select to authenticated
  using (user_id = (select auth.uid()));

create policy members_read on public.members for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0 or (select public.is_app_manager()));
-- Creating people goes through the admin-users function (it needs an auth
-- user). Admins edit name, role and active here.
create policy members_admin_update on public.members for update to authenticated
  using ((select public.member_rank(restaurant_id)) = 3)
  with check ((select public.member_rank(restaurant_id)) = 3);

-- Catalog: members read, chefs and admins write.
create policy stations_read on public.stations for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy stations_write on public.stations for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

create policy suppliers_read on public.suppliers for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy suppliers_write on public.suppliers for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

create policy items_read on public.items for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy items_write on public.items for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

create policy recipe_lines_read on public.recipe_lines for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy recipe_lines_write on public.recipe_lines for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

-- Entries: a cook sees and logs their own and may take one back for 10 minutes.
-- Chefs and admins see and change everything in their restaurant.
create policy entries_read on public.waste_entries for select to authenticated
  using (logged_by = (select auth.uid()) or (select public.member_rank(restaurant_id)) >= 2);
-- restaurant_id is set from the item by the trigger before this check runs.
create policy entries_insert on public.waste_entries for insert to authenticated
  with check ((select public.member_rank(restaurant_id)) > 0);
create policy entries_update on public.waste_entries for update to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);
create policy entries_delete on public.waste_entries for delete to authenticated
  using (
    (select public.member_rank(restaurant_id)) >= 2
    or (logged_by = (select auth.uid())
        and logged_at > now() - interval '10 minutes'
        and (select public.member_rank(restaurant_id)) > 0)
  );

create policy covers_read on public.covers for select to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2);
create policy covers_write on public.covers for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);

create policy audit_read on public.audit_log for select to authenticated
  using ((select public.is_app_manager()));
