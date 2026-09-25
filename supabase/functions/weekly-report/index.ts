import { admin, cors, json, sendMail } from '../_shared/common.ts'
import { euro, dutchDate, render } from './render.ts'

/**
 * Monday's email: last week's waste, per restaurant, to its report_emails.
 * Called by pg_cron with the secret it keeps in Vault (see the
 * weekly_report_cron migration). Body may name one restaurant_id and
 * week_start to (re)send a specific week by hand.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const db = admin()
  const { data: ok } = await db.rpc('cron_secret_ok', {
    p_secret: req.headers.get('x-cron-secret') ?? '',
  })
  if (ok !== true) return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  let q = db.from('restaurants').select('id, name, timezone, report_emails')
  if (typeof body.restaurant_id === 'string') q = q.eq('id', body.restaurant_id)
  const { data: restaurants, error } = await q
  if (error) return json({ error: 'server' }, 500)

  const sent: string[] = []
  for (const r of restaurants ?? []) {
    if (!r.report_emails?.length) continue
    const weekStart =
      typeof body.week_start === 'string' ? body.week_start : lastWeekMonday(r.timezone)
    const { data: report, error: reportError } = await db.rpc('weekly_report', {
      p_restaurant: r.id,
      p_week_start: weekStart,
    })
    if (reportError) {
      console.error(r.id, reportError)
      continue
    }
    const ok = await sendMail(
      r.report_emails,
      `Verspilling ${r.name}, week van ${dutchDate(weekStart)}: ${euro(report.total)}`,
      render(r.name, report),
    )
    if (ok) sent.push(r.id)
  }
  return json({ sent })
})

/** Monday of the week before the current one, in the restaurant's own time zone. */
function lastWeekMonday(timezone: string): string {
  // en-CA formats as YYYY-MM-DD.
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const sinceMonday = (today.getDay() + 6) % 7
  today.setDate(today.getDate() - sinceMonday - 7)
  return today.toLocaleDateString('en-CA')
}
