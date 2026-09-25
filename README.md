# SOFA Verspilling

Kitchen waste logging for SOFA Maastricht. Cooks log what they throw away in seconds; chefs see it in euros per week, and a report goes out every Monday.

Live: https://northstartlabas.github.io/sofa-waste/

## Stack

Vite + React + TypeScript + Tailwind v4, on Supabase (database, auth, storage, edge functions) in the shared project **SOFAMaastricht** (`tpxazvmtzwvqddgqckry`). Deployed to GitHub Pages on every push to `main`.

## Local development

```bash
cp .env.example .env   # Supabase URL + publishable key
npm install
npm run dev            # http://localhost:5173/sofa-waste/
```

Checks: `npm run build`, `npm run lint`, `npm run check:contrast`. Database tests are in `supabase/tests/*.sql`; each runs in a transaction that rolls back.

Migrations are in `supabase/migrations/`, named after the version the database recorded. Edge functions (`pin-login`, `set-pin`, `admin-users`, `weekly-report`) deploy with `supabase functions deploy <name> --no-verify-jwt`; each checks its own caller.

## Shared catalog: moving the order app over

This database is meant to hold the order app's catalog too. A raw product here already carries every field an ingredient there has, so the move is a mapping, not a redesign:

| Order app (`ingredients`) | Here (`items`, `kind = 'raw'`) |
|---|---|
| `name` | `name` |
| `unit` (Doos, Fles, Kilo) | `order_unit` |
| `location_id` → `locations` | `location_id` → `locations` (required for raw, as there) |
| `sort_order` (within a location) | `sort_order` (set to the end of the location on insert or move) |
| `supplier_id` → `suppliers` | `supplier_id` → `suppliers` |
| `archived` | `archived` |
| `photo_path` (uuid folder with `full` + `thumb`) | `photo_path`, same bucket name (`ingredient-photos`) and format |

The rest of the order app has its tables here too:

| Order app | Here |
|---|---|
| `dishes` | `dishes` (+ `restaurant_id`) |
| `dish_ingredients (dish_id, ingredient_id)` | `dish_items (dish_id, item_id)` |
| `orders (sent_at, sent_by, user_id)` | `orders`, append-only, same columns |
| `order_lines (ingredient_id, ingredient_name, unit, quantity)` | `order_lines (item_id, item_name, unit, quantity)` |

**Copied on 2026-09-25** with `scripts/import-order-app/` (ids kept, the order app only read): 146 products, 3 locations, 3 suppliers, 132 photos, 22 dishes with 129 links, 39 orders with 719 lines. Each product's waste unit was guessed from its order unit (bottles in ml, pieces counted, the rest in grams); a chef can change it. Imported orders keep who sent them by name; the old accounts don't exist here, so they aren't linked to a login.

Still to do when the order app itself moves:

- Point it at this project and rename its queries to the tables above.
- Re-run the import first: it adds anything created in the order app since, but doesn't update rows that changed.
- Its users need accounts here (the waste app's PIN accounts are a different sign-in).
- `basket_items` (unsent baskets) weren't copied; they empty at midnight anyway.
- The order app lets every account edit the catalog; here only chefs and admins can.
