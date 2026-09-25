import { BackspaceIcon } from '@phosphor-icons/react'
import { useT } from '../lib/i18n'

/**
 * The number pad for PINs and quantities. Big enough for a thumb in a glove:
 * every key is at least 64px tall on a phone, and nothing needs the phone's
 * keyboard, which covers half the screen and jumps around.
 */
export function Keypad({
  onKey,
  decimal = false,
}: {
  onKey: (k: string) => void
  decimal?: boolean
}) {
  const { t } = useT()
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? ',' : '', '0', 'back']
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k, i) =>
        k ? (
          <button
            key={i}
            type="button"
            onClick={() => onKey(k)}
            aria-label={k === 'back' ? t('erase') : k}
            className="num flex min-h-16 items-center justify-center rounded-full border border-line bg-paper-raised text-2xl font-medium text-ink transition active:scale-[.97] active:bg-paper-sunk lg:min-h-14 lg:hover:border-line-strong"
          >
            {k === 'back' ? <BackspaceIcon size={26} aria-hidden /> : k}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  )
}
