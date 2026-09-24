/**
 * The number pad for PINs and quantities. Big enough for a thumb in a glove:
 * every key is at least 64px tall, and nothing needs the phone's keyboard,
 * which covers half the screen and jumps around.
 */
export function Keypad({
  onKey,
  decimal = false,
}: {
  onKey: (k: string) => void
  decimal?: boolean
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? ',' : '', '0', '⌫']
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k, i) =>
        k ? (
          <button
            key={i}
            type="button"
            onClick={() => onKey(k)}
            aria-label={k === '⌫' ? 'Wis' : k}
            className="num min-h-16 rounded-full border border-line bg-paper-raised text-2xl font-medium text-ink transition active:scale-[.97] active:bg-paper-sunk"
          >
            {k}
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  )
}
