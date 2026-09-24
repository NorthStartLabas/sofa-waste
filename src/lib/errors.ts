import { QueryError } from '../data/query'
import { translator, type Key } from './i18n'
import { savedLang } from './device'

/**
 * What a person in a kitchen needs to hear, not what PostgREST says. Only the
 * failures somebody can act on get their own words; the rest say "something
 * went wrong" with the server's text after it, for whoever gets asked.
 */
export function errorMessage(e: unknown): string {
  const t = translator(savedLang())
  const message = e instanceof Error ? e.message : String(e)
  const known: [RegExp, Key][] = [
    [/recipe_cycle/, 'recipeCycle'],
    [/violates foreign key constraint.*recipe_lines/i, 'inUse'],
    [/failed to fetch|load failed|network/i, 'errorNetwork'],
  ]
  for (const [re, key] of known) if (re.test(message)) return t(key)
  if (e instanceof QueryError && e.retriable) return t('errorNetwork')
  return `${t('errorGeneric')} (${message})`
}
