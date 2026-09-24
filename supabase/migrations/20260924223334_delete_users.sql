-- Deleting a person must not delete, or be blocked by, what they logged. Their
-- entries keep logged_by_name (a snapshot) and lose only the link to the login.
alter table public.waste_entries alter column logged_by drop not null;
alter table public.waste_entries drop constraint waste_entries_logged_by_fkey;
alter table public.waste_entries
  add constraint waste_entries_logged_by_fkey
  foreign key (logged_by) references auth.users (id) on delete set null;

-- The fill trigger pins logged_by on update, which would undo the set null the
-- foreign key performs and make the delete fail. Emptying it is allowed;
-- changing it to someone else still is not.
create or replace function public.waste_entry_fill()
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
    if new.logged_by is null then
      raise exception 'Not signed in' using errcode = 'P0001';
    end if;
  else
    new.id := old.id;
    new.restaurant_id := old.restaurant_id;
    new.item_id := old.item_id;
    new.item_name := old.item_name;
    new.unit := old.unit;
    new.cleaned := old.cleaned;
    new.unit_cost := old.unit_cost;
    if new.logged_by is not null then new.logged_by := old.logged_by; end if;
    new.logged_by_name := old.logged_by_name;
    new.logged_at := old.logged_at;
  end if;
  new.cost := round(new.unit_cost * new.qty, 4);
  return new;
end;
$$;
