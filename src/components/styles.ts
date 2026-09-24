// Shared control classes. The brand has one interactive shape: the pill.
// Panels, images and cards stay square. Every target clears 48px.

const pill =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-medium transition active:scale-[.98] disabled:opacity-50 disabled:active:scale-100'

export const primaryButton = `${pill} bg-accent text-accent-contrast hover:bg-accent-hover`
export const secondaryButton = `${pill} border border-line-strong bg-paper-raised text-ink hover:border-accent`
export const quietButton = `${pill} text-accent underline-offset-4 hover:underline`
export const dangerButton = `${pill} border border-danger text-danger hover:bg-danger hover:text-paper`

export const input =
  'min-h-12 w-full rounded-full border border-line-strong bg-paper-raised px-5 text-base text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none'
export const select = `${input} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235a6968' stroke-width='1.5'/%3E%3C/svg%3E")] bg-[length:12px_8px] bg-[position:right_1.25rem_center] bg-no-repeat pr-12`
export const textarea =
  'w-full border border-line-strong bg-paper-raised p-4 text-base text-ink focus:border-accent focus:outline-none'

/** A toggle chip: filled when on. */
export function chip(on: boolean): string {
  return `${pill} min-h-12 px-5 ${on ? 'bg-accent text-accent-contrast' : 'border border-line-strong bg-paper-raised text-ink'}`
}

export const panel = 'border border-line bg-paper-raised'
export const column = 'mx-auto w-full max-w-2xl page-x'
