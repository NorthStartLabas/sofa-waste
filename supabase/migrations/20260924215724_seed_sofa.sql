-- The first restaurant and its stations. Report goes to Liviu until the owner
-- and chef addresses are set on the Week screen.
with r as (
  insert into public.restaurants (name, report_emails)
  values ('SOFA Maastricht', array['liviu@northstarlabs.nl'])
  returning id
)
insert into public.stations (restaurant_id, name, sort_order)
select r.id, s.name, s.ord
from r, (values ('garde', 1), ('patisserie', 2), ('roti', 3), ('entremetier', 4)) as s (name, ord);
