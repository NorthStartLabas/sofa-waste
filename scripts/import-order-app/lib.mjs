// Copies the order app's catalog, dishes and order history into this database.
// The order app's project is only ever read (sql() refuses anything but SELECT).
//
//   node scripts/import-order-app/data.mjs     rows, one transaction, ids kept
//   node scripts/import-order-app/photos.mjs   photo files, same folders
//   node scripts/import-order-app/verify.mjs   counts, fields and bytes compared
//
// Re-runnable: rows that already exist are skipped, so a second run adds what
// the order app gained since, but does not update rows that changed there.
// Needs `supabase login` (the token is read from the macOS keychain).
import { execSync } from 'node:child_process'
export const OLD = 'iqfbcnqljhixnrawjrwg'
export const NEW = 'tpxazvmtzwvqddgqckry'
export const RESTAURANT = '2300fcbd-f035-4cca-99c2-6dc9571fd1ec'
const token = execSync('security find-generic-password -s "Supabase CLI" -a supabase -w')
  .toString()
  .trim()
export async function sql(ref, query) {
  if (ref === OLD && !/^\s*select\b/i.test(query))
    throw new Error('refusing to run anything but SELECT on the order app')
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${ref} ${res.status}: ${body.slice(0, 400)}`)
  return JSON.parse(body)
}
export async function serviceKey(ref) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const keys = await res.json()
  return (keys.find((k) => k.name === 'service_role') ?? keys.find((k) => k.type === 'secret'))
    .api_key
}
// What waste is weighed or counted in. A guess from how it's ordered; the chef can change it.
export function wasteUnit(orderUnit, name) {
  const u = `${orderUnit ?? ''}`.toLowerCase()
  if (/fles/.test(u)) return 'ml'
  if (/stuk/.test(u)) return 'pcs'
  return 'g'
}
