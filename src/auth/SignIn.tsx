import { useState, type ReactNode } from 'react'
import { Keypad } from '../components/Keypad'
import { Logo } from '../components/Logo'
import dish from '../assets/signin-dish.webp'
import { input, primaryButton, quietButton } from '../components/styles'
import { forgetPerson, knownPeople, type KnownPerson } from '../lib/device'
import { time } from '../lib/format'
import { useT } from '../lib/i18n'
import { callFunction, supabase } from '../lib/supabase'

/**
 * Tap your name, type four digits. People who signed in on this device before
 * are tiles, so switching on the shared tablet is two taps and a PIN.
 */
export function SignIn() {
  const { t, lang } = useT()
  const [people, setPeople] = useState(knownPeople)
  const [person, setPerson] = useState<KnownPerson | null>(null)
  const [typing, setTyping] = useState(people.length === 0)
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(full: string, who: string) {
    setBusy(true)
    setError(null)
    try {
      const { status, data } = await callFunction<{
        access_token?: string
        refresh_token?: string
        error?: string
        until?: string
      }>('pin-login', { email: who, pin: full })
      if (status === 200 && data.access_token && data.refresh_token) {
        const { error: e } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (e) throw e
        return
      }
      setError(
        data.error === 'locked' && data.until
          ? t('lockedUntil', { time: time(data.until, lang) })
          : status === 401 || status === 400
            ? t('wrongPin')
            : t('errorGeneric'),
      )
    } catch {
      setError(t('errorNetwork'))
    } finally {
      setPin('')
      setBusy(false)
    }
  }

  function onKey(k: string) {
    if (busy || !person) return
    if (k === 'back') return setPin((p) => p.slice(0, -1))
    const next = (pin + k).slice(0, 4)
    setPin(next)
    if (next.length === 4) void submit(next, person.email)
  }

  if (person) {
    return (
      <Frame>
        <p className="eyebrow mb-2">{t('enterPin')}</p>
        <h1 className="text-h2 mb-6">{person.name}</h1>
        <PinDots count={pin.length} />
        <p role="alert" className="mb-4 min-h-6 text-danger">
          {error}
        </p>
        <Keypad onKey={onKey} />
        <p className="mt-6 text-ink-muted">{t('forgotPin')}</p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <button
            type="button"
            className={quietButton}
            onClick={() => {
              setPerson(null)
              setPin('')
              setError(null)
            }}
          >
            {t('back')}
          </button>
          {people.some((p) => p.email === person.email) && (
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                forgetPerson(person.email)
                setPeople(knownPeople())
                setPerson(null)
              }}
            >
              {t('forget')}
            </button>
          )}
        </div>
      </Frame>
    )
  }

  if (typing) {
    return (
      <Frame>
        <h1 className="text-h2 mb-6">{t('signInTitle')}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const clean = email.trim().toLowerCase()
            if (clean) setPerson({ email: clean, name: clean })
          }}
          className="flex flex-col gap-3"
        >
          <label className="eyebrow" htmlFor="email">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className={`${primaryButton} mt-2`}>{t('next')}</button>
          {people.length > 0 && (
            <button type="button" className={quietButton} onClick={() => setTyping(false)}>
              {t('back')}
            </button>
          )}
        </form>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 className="text-h2 mb-6">{t('signInTitle')}</h1>
      <div className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <button
            key={p.email}
            type="button"
            onClick={() => setPerson(p)}
            className="min-h-20 rounded-full border border-line-strong bg-paper-raised px-4 text-lg font-medium transition active:scale-[.98]"
          >
            {p.name}
          </button>
        ))}
      </div>
      <button type="button" className={`${quietButton} mt-6`} onClick={() => setTyping(true)}>
        {t('someoneElse')}
      </button>
    </Frame>
  )
}

export function PinDots({ count }: { count: number }) {
  return (
    <div className="mb-4 flex gap-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`size-4 rounded-full border-2 border-accent ${i < count ? 'bg-accent' : ''}`}
        />
      ))}
    </div>
  )
}

export function Frame({ children }: { children: ReactNode }) {
  const { t } = useT()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Desktop only: one of SOFA's own plates, under a moss scrim with the wordmark. */}
      <div className="relative hidden overflow-hidden bg-deep lg:block">
        <img
          src={dish}
          alt=""
          width={900}
          height={900}
          className="absolute inset-0 size-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-deep via-deep/30 to-deep/60" />
        <div className="relative flex h-full flex-col justify-between p-12 text-on-deep">
          <Logo className="h-7" />
          <p className="max-w-sm font-display text-h2">{t('signInTagline')}</p>
        </div>
      </div>
      <div className="flex min-h-dvh flex-col">
        <header className="bg-deep pt-[env(safe-area-inset-top)] text-on-deep lg:hidden">
          <div className="page-x mx-auto flex h-14 max-w-md items-center">
            <Logo className="h-5" />
          </div>
        </header>
        <main className="page-x mx-auto w-full max-w-md flex-1 py-10 lg:flex lg:flex-col lg:justify-center lg:py-16">
          {children}
        </main>
      </div>
    </div>
  )
}
