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

What the move still needs:

- `locations` and `suppliers` rows need a `restaurant_id`.
- Each ingredient needs a waste `unit` here (`g`, `ml` or `pcs`), which is a different thing from what it's ordered in.
- `dishes` and `dish_ingredients` are not in this database yet; they come with the order app.
- The order app lets every account edit the catalog; here only chefs and admins can.
