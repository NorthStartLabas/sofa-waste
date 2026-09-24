import { useEffect, type ReactNode } from 'react'
import { useT } from '../lib/i18n'

/** A panel that rises from the bottom over a dimmed page. Square, like every panel. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-deep/50 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="rise max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-paper px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-h3">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 px-2 text-accent underline-offset-4 hover:underline"
          >
            {t('close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
