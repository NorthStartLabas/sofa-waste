/** "1,5" and "1.5" both mean one and a half. Empty or nonsense is null. */
export function parseNumber(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() === '' || !Number.isFinite(n) ? null : n
}

export function showNumber(n: number | null | undefined): string {
  return n == null ? '' : String(n).replace('.', ',')
}
