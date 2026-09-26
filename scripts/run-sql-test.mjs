// Runs a supabase/tests/*.sql file against the shared project and prints its
// last result. Each test file rolls itself back. Needs `supabase login`.
//   node scripts/run-sql-test.mjs supabase/tests/basket_test.sql
import { readFileSync } from 'node:fs'
import { sql, NEW } from './import-order-app/lib.mjs'
for (const file of process.argv.slice(2)) {
  try {
    const rows = await sql(NEW, readFileSync(file, 'utf8'))
    console.log(file, JSON.stringify(rows.at?.(-1) ?? rows))
  } catch (e) {
    console.log(file, 'FAILED', e.message.slice(0, 500))
    process.exitCode = 1
  }
}
