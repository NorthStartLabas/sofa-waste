/** Case- and accent-blind: "creme" finds "crème", "BLOEM" finds "bloemkool". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function matches(name: string, term: string): boolean {
  return normalize(name).includes(normalize(term.trim()))
}
