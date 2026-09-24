import logo from '../assets/sofa-logo.svg?raw'

/** SOFA's own wordmark, in currentColor so it works on paper and on the deep band. */
export function Logo({ className = 'h-6' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="SOFA"
      className={`inline-block [&>svg]:h-full [&>svg]:w-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: logo }}
    />
  )
}
