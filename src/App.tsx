import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth, useMember } from './auth/authContext'
import { SetPin } from './auth/SetPin'
import { Frame, SignIn } from './auth/SignIn'
import { Shell } from './components/Shell'
import { primaryButton, quietButton } from './components/styles'
import { CatalogProvider } from './data/CatalogProvider'
import { isShared, saveLang, savedLang } from './lib/device'
import { LangContext, translator, useT, type Lang } from './lib/i18n'
import { Audit } from './screens/Audit'
import { Catalog } from './screens/catalog/Catalog'
import { ItemEditor } from './screens/catalog/ItemEditor'
import { Covers } from './screens/Covers'
import { LogScreen } from './screens/LogScreen'
import { More } from './screens/More'
import { MyEntries } from './screens/MyEntries'
import { Overview } from './screens/Overview'
import { Users } from './screens/Users'
import { Week } from './screens/Week'

export default function App() {
  const [lang, setLangState] = useState<Lang>(savedLang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = (l: Lang) => {
    saveLang(l)
    setLangState(l)
  }
  return (
    <LangContext.Provider value={{ lang, t: translator(lang), setLang }}>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </LangContext.Provider>
  )
}

/** Session → membership loaded → own PIN chosen → the app. Nothing routed renders before all three. */
function Gate() {
  const { t } = useT()
  const { session, member, restaurant, loading, error, reload, signOut } = useAuth()

  if (!session) return <SignIn />
  if (loading && !member) return <Frame>{t('loading')}</Frame>
  if (error)
    return (
      <Frame>
        <p className="mb-4 text-danger">{error}</p>
        <button type="button" className={primaryButton} onClick={reload}>
          {t('retry')}
        </button>
      </Frame>
    )
  if (!member || !restaurant)
    return (
      <Frame>
        <p className="mb-4">{t('notMember')}</p>
        <button type="button" className={quietButton} onClick={() => void signOut()}>
          {t('signOut')}
        </button>
      </Frame>
    )
  if (member.must_change_pin) return <SetPin />

  return (
    <CatalogProvider key={restaurant.id} restaurantId={restaurant.id}>
      <IdleSignOut />
      <HashRouter>
        <Shell>
          <AppRoutes />
        </Shell>
      </HashRouter>
    </CatalogProvider>
  )
}

function AppRoutes() {
  const { isChef, isAdmin, isManager } = useMember()
  const only = (ok: boolean, el: ReactNode) => (ok ? el : <Navigate to="/" replace />)
  return (
    <Routes>
      <Route path="/" element={<LogScreen />} />
      <Route path="/mine" element={<MyEntries />} />
      <Route path="/more" element={<More />} />
      <Route path="/overview" element={only(isChef, <Overview />)} />
      <Route path="/week" element={only(isChef, <Week />)} />
      <Route path="/covers" element={only(isChef, <Covers />)} />
      <Route path="/catalog" element={only(isChef, <Catalog />)} />
      <Route path="/catalog/new/:kind" element={only(isChef, <ItemEditor />)} />
      <Route path="/catalog/:id" element={only(isChef, <ItemEditor />)} />
      <Route path="/users" element={only(isAdmin, <Users />)} />
      <Route path="/audit" element={only(isManager, <Audit />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const IDLE_MS = 2 * 60 * 1000

/**
 * On the shared tablet, an unattended session would log the next cook's
 * waste under the last cook's name. Two quiet minutes and it signs out.
 */
function IdleSignOut() {
  const { signOut } = useAuth()
  useEffect(() => {
    if (!isShared()) return
    let timer = window.setTimeout(() => void signOut(), IDLE_MS)
    const poke = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void signOut(), IDLE_MS)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, poke))
    }
  }, [signOut])
  return null
}
