import { APP_URL, escapeHtml } from '../_shared/common.ts'
import { button, C, heading, layout, row, rows, SANS, SERIF } from '../_shared/email.ts'

export function euro(n: number | null | undefined): string {
  if (n == null) return 'onvolledig'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

export function dutchDate(iso: string): string {
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
export type Report = {
  week_start: string
  total: number
  prev_total: number
  entries: number
  incomplete_entries: number
  covers: number
  per_cover: number | null
  by_day: { day: string; total: number; entries: number }[]
  by_reason: { reason: string; total: number | null; entries: number }[]
  by_station: { station: string | null; total: number | null; entries: number }[]
  top_items: Row[]
  repeated: Row[]
  incomplete: { name: string; entries: number }[]
}

const times = (n: number) => `${n} ${n === 1 ? 'registratie' : 'registraties'}`

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const qty = (x: Row) =>
  `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(x.qty)} ${UNITS[x.unit] ?? x.unit}`

/** The Monday email, as HTML. Pure: report JSON in, markup out. */
export function render(restaurant: string, r: Report): string {
  const diff = r.total - r.prev_total
  const worse = diff > 0
  const weekEnd = new Date(`${r.week_start}T12:00:00`)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const range = `${dutchDate(r.week_start)} tot ${weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`

  const change =
    r.prev_total > 0
      ? `<span style="color:${worse ? C.clay : C.accent};font-weight:600;">${euro(Math.abs(diff))} ${worse ? 'meer' : 'minder'}</span> dan vorige week (${euro(r.prev_total)})`
      : `Vorige week: ${euro(r.prev_total)}`

  const stat = (label: string, value: string, note = '') =>
    `<td class="stack" width="50%" valign="top" style="box-sizing:border-box;padding:18px 20px;background:${C.raised};border:1px solid ${C.line};">
      <div style="font-family:${SANS};font-size:14px;color:${C.muted};">${label}</div>
      <div style="font-family:${SERIF};font-size:28px;line-height:1.2;color:${C.ink};margin-top:4px;">${value}</div>
      ${note ? `<div style="font-family:${SANS};font-size:13px;color:${C.muted};margin-top:2px;">${note}</div>` : ''}
    </td>`

  const maxDay = Math.max(...r.by_day.map((d) => d.total), 0)
  const days = r.by_day
    .map((d) =>
      row(
        capitalize(new Date(`${d.day}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'long' })),
        d.entries ? times(d.entries) : 'niets',
        d.entries ? euro(d.total) : '',
        maxDay ? d.total / maxDay : 0,
      ),
    )
    .join('')

  const top = r.top_items[0]?.total ?? 0
  const reasonMax = r.by_reason[0]?.total ?? 0
  const stationMax = r.by_station[0]?.total ?? 0

  const body = `
<p style="margin:0;font-family:${SANS};font-size:15px;color:${C.muted};">${escapeHtml(restaurant)}, week van ${range}</p>
<div class="hero" style="margin:6px 0 4px;font-family:${SERIF};font-weight:500;font-size:56px;line-height:1.05;color:${C.clay};">${euro(r.total)}</div>
<p style="margin:0 0 28px;">${change}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>${stat('Registraties', String(r.entries), r.incomplete_entries ? `${r.incomplete_entries} zonder volledige kosten` : '')}
      ${stat('Per cover', r.per_cover != null ? euro(r.per_cover) : 'geen covers', r.covers ? `${r.covers} covers` : 'vul covers in in de app')}</tr>
</table>

${
  r.repeated.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
<tr><td style="padding:20px 24px;background:${C.raised};border-left:3px solid ${C.clay};">
  <div style="font-family:${SERIF};font-size:24px;line-height:1.2;color:${C.ink};">Op 3 of meer dagen weggegooid</div>
  <div style="font-family:${SANS};font-size:15px;color:${C.muted};margin:4px 0 8px;">Vaak een teken dat de batch te groot is.</div>
  ${rows(r.repeated.map((x) => row(escapeHtml(x.name), `${x.days} dagen, ${qty(x)}`, euro(x.total))).join(''))}
</td></tr></table>`
    : ''
}

${heading('Per dag')}
${rows(days)}

${heading('Top producten')}
${
  r.top_items.length
    ? rows(
        r.top_items
          .map((x) =>
            row(escapeHtml(x.name), qty(x), euro(x.total), top ? (x.total ?? 0) / top : 0),
          )
          .join(''),
      )
    : `<p style="color:${C.muted};">Niets met volledige kosten deze week.</p>`
}

${heading('Per reden')}
${rows(r.by_reason.map((x) => row(REASONS[x.reason] ?? x.reason, times(x.entries), euro(x.total), reasonMax ? (x.total ?? 0) / reasonMax : 0)).join(''))}

${heading('Per station')}
${rows(r.by_station.map((x) => row(escapeHtml(x.station ?? 'Zonder station'), times(x.entries), euro(x.total), stationMax ? (x.total ?? 0) / stationMax : 0)).join(''))}

${
  r.incomplete.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
<tr><td style="padding:16px 20px;background:${C.raised};border:1px solid ${C.line};font-family:${SANS};font-size:15px;">
  <b>Kosten onvolledig</b><br>
  <span style="color:${C.muted};">Prijs of batchgewicht ontbreekt voor: </span>${r.incomplete.map((x) => `${escapeHtml(x.name)} (${x.entries}x)`).join(', ')}
</td></tr></table>`
    : ''
}

<div style="margin-top:36px;">${button('Bekijk de week in de app', `${APP_URL}#/week`)}</div>`

  return layout({
    preheader: `${euro(r.total)} weggegooid, ${r.entries} registraties. ${r.repeated.length ? `${r.repeated.length} product(en) op 3+ dagen.` : ''}`,
    eyebrow: 'Weekrapport',
    body,
  })
}
