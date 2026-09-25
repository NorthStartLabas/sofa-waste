-- Raw products carry everything the order app's ingredients have, so that app
-- can read them when it moves onto this database: a location on the walking
-- route (required, as there), a place on that route, what you order in, and a
-- photo in the order app's own format.

create table public.locations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (btrim(name) <> ''),
  -- The walking route through the kitchen. Reordered in the order app.
  sort_order    integer not null default 0
);
create index locations_restaurant_idx on public.locations (restaurant_id, sort_order);

alter table public.locations enable row level security;
revoke all on public.locations from anon;
create policy locations_read on public.locations for select to authenticated
  using ((select public.member_rank(restaurant_id)) > 0);
create policy locations_write on public.locations for all to authenticated
  using ((select public.member_rank(restaurant_id)) >= 2)
  with check ((select public.member_rank(restaurant_id)) >= 2);
create trigger locations_audit after insert or update or delete on public.locations
for each row execute function public.audit_row();

alter table public.items
  -- restrict, as in the order app: empty a location before deleting it.
  add column location_id uuid references public.locations (id) on delete restrict,
  -- What you order in: Doos, Fles, Kilo. The order app calls this `unit`; here
  -- `unit` is what waste is weighed in (g, ml, pcs).
  add column order_unit text,
  -- Position within the location, from 0, as in the order app.
  add column sort_order integer not null default 0,
  -- A bare uuid folder in the ingredient-photos bucket holding "full" and
  -- "thumb". Never a URL. Same format as the order app's ingredients.
  add column photo_path text,
  add constraint items_raw_has_location check (kind = 'prep' or location_id is not null);
create index items_location_idx on public.items (location_id, sort_order);

-- A product joins the end of its location's route, on creation and when it
-- moves. Reordering stays the order app's job.
create function public.item_route_place()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.location_id is not null
     and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    if (select restaurant_id from public.locations where id = new.location_id)
       is distinct from new.restaurant_id then
      raise exception 'Location belongs to another restaurant' using errcode = 'P0001';
    end if;
    select coalesce(max(sort_order) + 1, 0) into new.sort_order
    from public.items
    where location_id = new.location_id and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger items_route_place
before insert or update of location_id on public.items
for each row execute function public.item_route_place();

-- The view was made from i.* when items had fewer columns.
drop view public.items_with_cost;
create view public.items_with_cost
with (security_invoker = true)
as
select
  i.*,
  public.item_unit_cost(i.id, false) as unit_cost,
  case when i.yield_pct is not null then public.item_unit_cost(i.id, true) end as cleaned_unit_cost
from public.items i;
revoke all on public.items_with_cost from anon;

-- Product photos, in the order app's bucket and format: public read (a photo
-- of celery), one new folder per upload. Writes need a chef or admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ingredient-photos', 'ingredient-photos', true, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy ingredient_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ingredient-photos');
create policy ingredient_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ingredient-photos' and exists (
    select 1 from public.members
    where user_id = (select auth.uid()) and active and role in ('chef', 'admin')));
create policy ingredient_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ingredient-photos' and exists (
    select 1 from public.members
    where user_id = (select auth.uid()) and active and role in ('chef', 'admin')));
