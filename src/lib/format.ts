import type { Lang } from './i18n'

const locale = (lang: Lang) => (lang === 'nl' ? 'nl-NL' : 'en-GB')

/** Euros, or a dash for "incomplete". Never €0,00 for a cost nobody knows. */
export function euro(n: number | null | undefined, lang: Lang, digits = 2): string {
  if (n == null) return '—'
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function number(n: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(n)
}

export function time(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' })
}

export function day(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(locale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Local calendar date as YYYY-MM-DD. The device stands in the kitchen; its clock is the kitchen's. */
export function isoDate(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

export function monday(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** "6000 ml" reads worse than "6 L" on a price label. */
export function packLabel(qty: number, unit: string, lang: Lang): string {
  if (unit === 'g' && qty >= 1000) return `${number(qty / 1000, lang, 3)} kg`
  if (unit === 'ml' && qty >= 1000) return `${number(qty / 1000, lang, 3)} L`
  return `${number(qty, lang, 2)} ${unit === 'pcs' ? (lang === 'nl' ? 'st' : 'pcs') : unit}`
}

/** €/kg, €/L or €/st: the number a chef recognises from the invoice. */
export function perBigUnit(unitCost: number, unit: string, lang: Lang): string {
  if (unit === 'g') return `${euro(unitCost * 1000, lang)} / kg`
  if (unit === 'ml') return `${euro(unitCost * 1000, lang)} / L`
  return `${euro(unitCost, lang)} / ${lang === 'nl' ? 'st' : 'pc'}`
}
