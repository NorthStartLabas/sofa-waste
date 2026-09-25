import type { ReactNode } from 'react'
import { WarningCircleIcon, type Icon } from '@phosphor-icons/react'
import { useT } from '../lib/i18n'

/** Grey bars in the shape of the rows that are coming, instead of "Loading…". */
export function SkeletonRows({ rows = 5, tall = false }: { rows?: number; tall?: boolean }) {
  const { t } = useT()
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="animate-pulse motion-reduce:animate-none"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 border-b border-line ${tall ? 'py-5' : 'py-4'}`}
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-paper-sunk" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            {tall && <div className="h-3 w-1/3 bg-paper-sunk" />}
          </div>
          <div className="h-4 w-16 bg-paper-sunk" />
        </div>
      ))}
    </div>
  )
}

/** Nothing here yet: say why, and offer the one thing that fixes it. */
export function Empty({
  icon: I,
  title,
  children,
}: {
  icon: Icon
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-line-strong px-6 py-10 lg:items-center lg:text-center">
      <I size={32} className="text-accent" aria-hidden />
      <p className="font-display text-h3">{title}</p>
      {children}
    </div>
  )
}

/** A failure the person can act on, with the retry next to it. */
export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT()
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-l-2 border-danger bg-paper-raised px-4 py-3 text-danger"
    >
      <WarningCircleIcon size={20} aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-12 font-medium underline underline-offset-4"
        >
          {t('retry')}
        </button>
      )}
    </div>
  )
}
