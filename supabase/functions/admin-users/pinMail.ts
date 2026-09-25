import { escapeHtml } from '../_shared/common.ts'
import { button, C, layout, SANS, SERIF } from '../_shared/email.ts'

/** The welcome email with a temporary PIN, as HTML. */
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
    preheader: `Je tijdelijke pincode voor de verspillingsapp van ${restaurant}.`,
    eyebrow: 'Welkom',
    banner: true,
    body: `
<h1 style="margin:0 0 12px;font-family:${SERIF};font-weight:500;font-size:36px;line-height:1.15;color:${C.ink};">Welkom, ${escapeHtml(name)}</h1>
<p style="margin:0 0 28px;color:${C.muted};">Je hebt een account voor de verspillingsapp van ${escapeHtml(restaurant)}. Hiermee registreer je in een paar seconden wat er in de keuken wordt weggegooid.</p>

<p style="margin:0 0 10px;font-weight:600;">Je tijdelijke pincode</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr>${digits}</tr></table>

${button('Open de app')}

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
  ${step(1, 'Open de app op je telefoon en zet hem op je beginscherm.')}
  ${step(2, 'Log in met dit e-mailadres en de pincode hierboven.')}
  ${step(3, 'Kies je eigen pincode van vier cijfers. Deze tijdelijke vervalt dan.')}
</table>

<p style="margin:36px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-size:14px;color:${C.muted};">
  Hi ${escapeHtml(name)}, your temporary PIN for the ${escapeHtml(restaurant)} waste app is <b>${pin}</b>.
  Open the app, sign in with this email and the PIN, then choose your own.
</p>`,
  })
}
