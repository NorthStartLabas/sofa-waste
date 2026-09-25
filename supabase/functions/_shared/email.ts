import { APP_URL, escapeHtml } from './common.ts'

/**
 * The frame every email shares: SOFA's moss band with the wordmark, a paper
 * body, a moss footer. Tables and inline styles only, because that is what
 * Gmail and Outlook actually render. Brand fonts are named first and fall
 * back to Georgia and Helvetica where a client doesn't have them.
 */

export const C = {
  paper: '#f6f3ee',
  raised: '#fdfbf7',
  sunk: '#eae4da',
  ink: '#1d1d1b',
  muted: '#5a6968',
  line: '#d6cdbf',
  accent: '#3e5140',
  accentSoft: '#e4e7de',
  clay: '#96461f',
  deep: '#2b3529',
  onDeep: '#ede7da',
  onDeepMuted: '#b4b9a8',
}

export const SERIF = "'EB Garamond', Georgia, 'Times New Roman', serif"
export const SANS = "'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif"

const ASSETS = `${APP_URL}email/`

export function layout({
  preheader,
  eyebrow,
  body,
  banner,
}: {
  /** The grey line an inbox shows after the subject. */
  preheader: string
  /** Small text in the header band, right of the logo. */
  eyebrow: string
  body: string
  /** Optional photo under the header band. */
  banner?: boolean
}): string {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>SOFA Verspilling</title>
<!-- Apple Mail and iOS use these; Gmail and Outlook ignore them and fall back to Georgia and Helvetica. -->
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&family=Inter+Tight:wght@400;600&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .hero { font-size: 44px !important; }
    .stack { display: block !important; width: 100% !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.sunk};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sunk};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.paper};">
  <tr><td class="px" style="background:${C.deep};padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${ASSETS}sofa-logo.png" width="76" height="28" alt="SOFA" style="display:block;border:0;"></td>
      <td align="right" style="font-family:${SANS};font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:${C.onDeepMuted};">${escapeHtml(eyebrow)}</td>
    </tr></table>
  </td></tr>
  ${
    banner
      ? `<tr><td><img src="${ASSETS}welcome.jpg" width="600" alt="" style="display:block;width:100%;height:auto;border:0;"></td></tr>`
      : ''
  }
  <tr><td class="px" style="padding:40px 40px 48px;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.ink};">
    ${body}
  </td></tr>
  <tr><td class="px" style="background:${C.deep};padding:24px 40px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.onDeepMuted};">
    SOFA Maastricht, keukenverspilling<br>
    <a href="${APP_URL}" style="color:${C.onDeep};">${APP_URL.replace('https://', '')}</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

/** A moss pill that Outlook renders too (the cell carries the colour, not the link). */
export function button(label: string, url = APP_URL): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr>
<td style="background:${C.accent};border-radius:999px;">
<a href="${url}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:${C.paper};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr></table>`
}

export function heading(text: string, size = 26): string {
  return `<h2 style="margin:40px 0 12px;font-family:${SERIF};font-weight:500;font-size:${size}px;line-height:1.2;color:${C.ink};">${escapeHtml(text)}</h2>`
}

/**
 * A horizontal bar as long as `share` (0..1) of the row. A table cell with a
 * width, so it needs no image and survives every client.
 */
export function bar(share: number, colour = C.accent): string {
  const pct = Math.max(1, Math.min(100, Math.round(share * 100)))
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>
<td width="${pct}%" style="height:6px;background:${colour};font-size:0;line-height:0;">&nbsp;</td>
${pct < 100 ? `<td style="font-size:0;line-height:0;">&nbsp;</td>` : ''}
</tr></table>`
}

/** Name with a small detail line under it, the value on the right, optional bar underneath. */
export function row(name: string, detail: string, value: string, share?: number): string {
  return `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="font-family:${SANS};font-size:16px;line-height:1.35;color:${C.ink};">${name}${
    detail ? `<br><span style="font-size:14px;color:${C.muted};">${detail}</span>` : ''
  }</td>
  <td align="right" valign="top" style="font-family:${SANS};font-size:16px;color:${C.clay};white-space:nowrap;padding-left:16px;">${value}</td>
</tr></table>
${share != null ? bar(share) : ''}
</td></tr>`
}

export function rows(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>`
}
