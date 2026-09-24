import { admin, APP_URL, cors, escapeHtml, json, sendMail } from '../_shared/common.ts'

/**
 * Monday's email: last week's waste, per restaurant, to its report_emails.
 * Called by pg_cron with the CRON_SECRET header. Body may name one
 * restaurant_id and week_start to (re)send a specific week by hand.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret)
    return json({ error: 'unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const db = admin()
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

function euro(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function dutchDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

const REASONS: Record<string, string> = {
  made_too_much: 'Te veel gemaakt',
  expired: 'Over datum',
  spoiled: 'Bedorven',
  mistake: 'Fout / verbrand',
  dropped: 'Gevallen',
  supplier_quality: 'Slechte kwaliteit leverancier',
  other: 'Anders',
}

const UNITS: Record<string, string> = { g: 'g', ml: 'ml', pcs: 'st' }

type Row = {
  name: string
  unit: string
  qty: number
  total: number | null
  days: number
  entries: number
}
type Report = {
  week_start: string
  total: number
  prev_total: number
  entries: number
  incomplete_entries: number
  covers: number
  per_cover: number | null
  by_reason: { reason: string; total: number | null; entries: number }[]
  by_station: { station: string; total: number | null; entries: number }[]
  top_items: Row[]
  repeated: Row[]
  incomplete: { name: string; entries: number }[]
}

function render(restaurant: string, r: Report): string {
  const diff = r.total - r.prev_total
  const change =
    r.prev_total > 0
      ? `${diff >= 0 ? '+' : '−'}${euro(Math.abs(diff))} t.o.v. vorige week (${euro(r.prev_total)})`
      : `vorige week: ${euro(r.prev_total)}`
  const td = 'padding:6px 0;border-bottom:1px solid #d6cdbf'
  const table = (rows: string[][]) =>
    `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows
      .map(
        (cells) =>
          `<tr>${cells
            .map((c, i) => `<td style="${td}${i > 0 ? ';text-align:right' : ''}">${c}</td>`)
            .join('')}</tr>`,
      )
      .join('')}</table>`
  const h2 = (t: string) =>
    `<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#5a6968;margin:28px 0 8px">${t}</p>`
  const qty = (row: Row) => `${Math.round(row.qty)} ${UNITS[row.unit] ?? row.unit}`

  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1b;background:#f6f3ee;padding:32px;max-width:640px">
  <p style="font-family:Georgia,serif;font-size:28px;margin:0">${escapeHtml(restaurant)}</p>
  <p style="color:#5a6968;margin:4px 0 24px">Verspilling, week van ${dutchDate(r.week_start)}</p>
  <p style="font-family:Georgia,serif;font-size:44px;margin:0;color:#96461f">${euro(r.total)}</p>
  <p style="margin:4px 0">${change}</p>
  <p style="margin:4px 0;color:#5a6968">${r.entries} registraties${
    r.per_cover != null ? ` · ${euro(r.per_cover)} per cover (${r.covers} covers)` : ''
  }</p>
  ${
    r.repeated.length
      ? h2('Op 3+ dagen weggegooid (batch te groot?)') +
        table(r.repeated.map((x) => [escapeHtml(x.name), `${x.days} dagen`, qty(x), euro(x.total)]))
      : ''
  }
  ${h2('Top producten')}${
    r.top_items.length
      ? table(r.top_items.map((x) => [escapeHtml(x.name), qty(x), euro(x.total)]))
      : '<p>—</p>'
  }
  ${h2('Per reden')}${table(r.by_reason.map((x) => [REASONS[x.reason] ?? x.reason, `${x.entries}×`, euro(x.total)]))}
  ${h2('Per station')}${table(r.by_station.map((x) => [escapeHtml(x.station), `${x.entries}×`, euro(x.total)]))}
  ${
    r.incomplete.length
      ? h2('Kosten onvolledig (prijs of batchgewicht ontbreekt)') +
        table(r.incomplete.map((x) => [escapeHtml(x.name), `${x.entries}×`]))
      : ''
  }
  <p style="margin-top:32px"><a href="${APP_URL}" style="color:#3e5140">Open de app</a></p>
</div>`
}
