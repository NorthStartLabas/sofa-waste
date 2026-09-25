// Shared control classes. The brand has one interactive shape, the pill;
// panels, images and tables stay square. Every target clears 48px, and the
// same classes serve the phone and the desktop: nothing gets smaller on a
// bigger screen.

const pillBase =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,border-color,color] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-45'

export const primaryButton = `${pillBase} px-6 bg-accent text-accent-contrast hover:bg-accent-hover`
export const secondaryButton = `${pillBase} px-6 border border-line-strong bg-paper-raised text-ink hover:border-accent`
export const dangerButton = `${pillBase} px-6 border border-danger text-danger hover:bg-danger hover:text-paper`
/** A text action. No negative margins: it lines up by having no padding of its own. */
export const quietButton = `${pillBase} px-0 text-accent underline-offset-4 hover:underline`
/** Round icon-only control, e.g. remove a recipe line. Always pair with aria-label. */
export const iconButton = `${pillBase} size-12 shrink-0 text-ink-muted hover:bg-paper-sunk hover:text-ink`

/** A toggle pill: filled moss when on. */
export function chip(on: boolean): string {
  return `${pillBase} px-5 ${
    on
      ? 'bg-accent text-accent-contrast'
      : 'border border-line-strong bg-paper-raised text-ink hover:border-accent'
  }`
}

/** A field without a width, for when the layout sets it (a qty next to a name). */
export const inputBase =
  'min-h-12 rounded-full border border-line-strong bg-paper-raised px-5 text-base text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none'
export const input = `${inputBase} w-full`
export const select = `${input} cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235a6968' stroke-width='1.5'/%3E%3C/svg%3E")] bg-[length:12px_8px] bg-[position:right_1.25rem_center] bg-no-repeat pr-12`
export const textarea =
  'w-full border border-line-strong bg-paper-raised p-4 text-base text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none'

/** A form label above its control. */
export const label = 'text-base font-medium text-ink'
export const help = 'text-ink-muted'

/** A raised square panel, for things that sit on the page (forms, the entry panel). */
export const panel = 'border border-line bg-paper-raised'

/** Page widths. Narrow for reading and forms, wide for tables and splits. */
export const column = 'mx-auto w-full max-w-2xl page-x'
export const wide = 'mx-auto w-full max-w-[1200px] page-x'

/** Euros: clay, tabular. The brand keeps its clay for prices. */
export const money = 'num text-highlight'
