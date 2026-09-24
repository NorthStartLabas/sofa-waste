// Every text/background pair the app uses, against WCAG 2.1 AA (4.5:1).
// Reads the tokens from src/index.css so the check can't drift from the palette.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const token = (name) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!m) throw new Error(`missing token ${name}`)
  return m[1]
}

const pairs = [
  ['ink', 'paper'],
  ['ink', 'paper-raised'],
  ['ink', 'paper-sunk'],
  ['ink-muted', 'paper'],
  ['ink-muted', 'paper-raised'],
  ['ink-muted', 'paper-sunk'],
  ['accent', 'paper'],
  ['accent', 'paper-raised'],
  ['accent', 'accent-soft'],
  ['accent-contrast', 'accent'],
  ['accent-contrast', 'accent-hover'],
  ['highlight', 'paper'],
  ['highlight', 'paper-raised'],
  ['danger', 'paper'],
  ['danger', 'paper-raised'],
  ['on-deep', 'deep'],
  ['on-deep-muted', 'deep'],
]

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

let failed = 0
for (const [fg, bg] of pairs) {
  const r = ratio(token(fg), token(bg))
  const ok = r >= 4.5
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${fg} on ${bg}`)
}
process.exit(failed ? 1 : 0)
