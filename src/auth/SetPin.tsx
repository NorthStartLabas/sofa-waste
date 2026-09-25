import { useState } from 'react'
import { Keypad } from '../components/Keypad'
import { quietButton } from '../components/styles'
import { useT } from '../lib/i18n'
import { callFunction } from '../lib/supabase'
import { useAuth } from './authContext'
import { Frame, PinDots } from './SignIn'

/** First sign-in, or after a reset: the temporary PIN is replaced before anything else. */
export function SetPin() {
  const { t } = useT()
  const { reload, signOut } = useAuth()
  const [first, setFirst] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(chosen: string) {
    setBusy(true)
    try {
      const { status, data } = await callFunction<{ error?: string }>('set-pin', { pin: chosen })
      if (status === 200) return reload()
      setError(data.error === 'trivial' ? t('pinTrivial') : t('errorGeneric'))
    } catch {
      setError(t('errorNetwork'))
    } finally {
      setBusy(false)
      setFirst(null)
      setPin('')
    }
  }

  function onKey(k: string) {
    if (busy) return
    if (k === 'back') return setPin((p) => p.slice(0, -1))
    const next = (pin + k).slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    setError(null)
    if (first === null) {
      setFirst(next)
      setPin('')
    } else if (first === next) {
      void finish(next)
    } else {
      setError(t('pinMismatch'))
      setFirst(null)
      setPin('')
    }
  }

  return (
    <Frame>
      <h1 className="text-h2 mb-2">{first === null ? t('choosePin') : t('repeatPin')}</h1>
      <p className="mb-6 text-ink-muted">{t('choosePinHelp')}</p>
      <PinDots count={pin.length} />
      <p role="alert" className="mb-4 min-h-6 text-danger">
        {error}
      </p>
      <Keypad onKey={onKey} />
      <button type="button" className={`${quietButton} mt-6`} onClick={() => void signOut()}>
        {t('signOut')}
      </button>
    </Frame>
  )
}
