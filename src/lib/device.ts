/**
 * What this device remembers: who signed in here (for the tiles on the sign-in
 * screen), whether it is the shared kitchen tablet, and each person's recent
 * items. Conveniences only; losing any of it loses nothing.
 */
export type KnownPerson = { email: string; name: string }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the app works without it.
  }
}

export function knownPeople(): KnownPerson[] {
  return read<KnownPerson[]>('waste.people', [])
}

export function rememberPerson(p: KnownPerson): void {
  const rest = knownPeople().filter((x) => x.email !== p.email)
  write('waste.people', [p, ...rest].slice(0, 12))
}

export function forgetPerson(email: string): void {
  write(
    'waste.people',
    knownPeople().filter((x) => x.email !== email),
  )
}

export function isShared(): boolean {
  return read('waste.shared', false)
}

export function setShared(v: boolean): void {
  write('waste.shared', v)
}

export function recentItems(userId: string): string[] {
  return read<string[]>(`waste.recent.${userId}`, [])
}

export function pushRecentItem(userId: string, itemId: string): void {
  const rest = recentItems(userId).filter((x) => x !== itemId)
  write(`waste.recent.${userId}`, [itemId, ...rest].slice(0, 8))
}

export function savedLang(): 'nl' | 'en' {
  return read<'nl' | 'en'>('waste.lang', 'nl')
}

export function saveLang(l: 'nl' | 'en'): void {
  write('waste.lang', l)
}
