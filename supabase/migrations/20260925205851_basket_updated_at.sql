-- A basket row's updated_at moves on every change, as in the order app: the
-- midnight sweep decides by it, and an upsert doesn't send it.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger basket_items_set_updated_at
before update on public.basket_items
for each row execute function public.set_updated_at();
