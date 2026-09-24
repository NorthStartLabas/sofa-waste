import { registerSW } from 'virtual:pwa-register'

/** How often a running app asks whether a newer one has been deployed. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Keeps an installed app from running last week's code.
 *
 * The registration used to be the one vite-plugin-pwa injects into the HTML —
 * a bare `navigator.serviceWorker.register(...)` with nothing else. So a phone
 * with the app on the home screen kept the bundle it was installed with until
 * iOS happened to evict the page from memory, which can take days. That is why
 * a phone and a laptop, both signed in, could disagree about what the app even
 * looked like.
 *
 * Two halves, and both are needed:
 *
 * - **Find out.** A service worker only looks for a new version on navigation.
 *   A home-screen app that is never navigated never looks, so we ask on a timer
 *   and every time the phone comes out of a pocket.
 * - **Choose the moment.** `registerType` is `'prompt'`, so a new version waits
 *   instead of taking over the instant it lands. We take it up when the page
 *   becomes visible again *after* having been hidden — they put the phone down
 *   and picked it up. Never a reload under a thumb mid-service, and nothing is
 *   lost either way: an unsaved entry form is the only thing that could be lost, and nobody is mid-entry with the phone in a pocket.
 */
export function watchForUpdates(): void {
  // Nothing is registered by the dev server, and a reload loop while editing
  // would be its own kind of unusable.
  if (import.meta.env.DEV) return

  let waiting = false
  let wasHidden = false

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      window.setInterval(() => void registration.update(), CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true
      return
    }
    if (waiting && wasHidden) {
      waiting = false
      void updateSW(true)
    }
  })
}
