/** Entries grouped under Today / Tue 22 Sep, newest first. */
export function groupByDay<T extends { logged_at: string }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const r of rows) {
    const key = new Date(r.logged_at).toLocaleDateString('en-CA')
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.entries()]
}
