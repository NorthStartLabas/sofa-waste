import type { ReactNode } from 'react'
import { euro, number, time } from '../lib/format'
import { useT } from '../lib/i18n'
import type { Entry } from '../types'

/** One logged throw. The euro is clay, the brand's colour for prices. */
export function EntryRow({
  entry,
  thumb,
  showCook,
  stationName,
  onOpen,
  children,
}: {
  entry: Entry
  thumb?: string
  showCook?: boolean
  stationName?: string
  onOpen?: () => void
  children?: ReactNode
}) {
  const { t, lang } = useT()
  const body = (
    <>
      {thumb && <img src={thumb} alt="" className="size-12 shrink-0 object-cover" loading="lazy" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg">{entry.item_name}</span>
        <span className="block text-ink-muted">
          <span className="num">
            {number(entry.qty, lang, 2)} {t(`unit_${entry.unit}`)}
          </span>
          {entry.cleaned && ` · ${t('cleaned').toLowerCase()}`} · {t(`reason_${entry.reason}`)}
          {entry.note && ` · ${entry.note}`}
        </span>
        <span className="block text-ink-muted">
          {time(entry.logged_at, lang)}
          {stationName && ` · ${stationName}`}
          {showCook && ` · ${entry.logged_by_name}`}
        </span>
      </span>
      <span className="num shrink-0 text-right text-lg text-highlight">
        {entry.cost != null ? (
          euro(entry.cost, lang)
        ) : (
          <span className="text-ink-muted">{t('incomplete')}</span>
        )}
      </span>
    </>
  )
  return (
    <li className="border-b border-line">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-16 w-full items-center gap-3 py-3 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-16 items-center gap-3 py-3">{body}</div>
      )}
      {children}
    </li>
  )
}
