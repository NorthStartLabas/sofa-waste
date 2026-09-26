import { escapeHtml, ORDER_URL } from '../_shared/common.ts'
import { button, C, layout, SANS, SERIF } from '../_shared/email.ts'

/**
 * The welcome email with a temporary PIN, as HTML. One account and one PIN work
 * in both kitchen apps, so it opens either, whichever app the person was added from.
 */
export function pinMail(name: string, pin: string, restaurant: string): string {
  const digits = [...pin]
    .map(
      (d) =>
        `<td style="width:56px;height:68px;background:${C.raised};border:1px solid ${C.line};text-align:center;font-family:${SANS};font-size:34px;font-weight:600;color:${C.ink};">${d}</td>`,
    )
    .join('<td style="width:10px;"></td>')
  const step = (n: number, text: string) =>
    `<tr><td valign="top" style="width:32px;padding:6px 0;font-family:${SERIF};font-size:20px;color:${C.accent};">${n}</td>
     <td style="padding:6px 0;font-family:${SANS};font-size:16px;color:${C.ink};">${text}</td></tr>`

  return layout({
    preheader: `Je tijdelijke pincode voor de keuken-apps van ${restaurant}.`,
    eyebrow: 'Welkom',
    banner: true,
    body: `
<h1 style="margin:0 0 12px;font-family:${SERIF};font-weight:500;font-size:36px;line-height:1.15;color:${C.ink};">Welkom, ${escapeHtml(name)}</h1>
<p style="margin:0 0 28px;color:${C.muted};">Je hebt een account voor de keuken-apps van ${escapeHtml(restaurant)}: <b>Bestellen</b>, om producten voor de keuken te bestellen, en <b>Verspilling</b>, om te registreren wat er wordt weggegooid. Eén account en één pincode voor allebei.</p>

<p style="margin:0 0 10px;font-weight:600;">Je tijdelijke pincode</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr>${digits}</tr></table>

${button('Open Bestellen', ORDER_URL)}
${button('Open Verspilling')}

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
  ${step(1, 'Open een van de apps op je telefoon en zet hem op je beginscherm.')}
  ${step(2, 'Log in met dit e-mailadres en de pincode hierboven.')}
  ${step(3, 'Kies je eigen pincode van vier cijfers. Deze tijdelijke vervalt dan, en je eigen pincode werkt in beide apps.')}
</table>

<p style="margin:36px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-size:14px;color:${C.muted};">
  Hi ${escapeHtml(name)}, your temporary PIN for the ${escapeHtml(restaurant)} kitchen apps (ordering and waste) is <b>${pin}</b>.
  Open either app, sign in with this email and the PIN, then choose your own. It works in both.
</p>`,
  })
}
