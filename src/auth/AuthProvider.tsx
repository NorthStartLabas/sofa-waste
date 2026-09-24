import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchIsManager, fetchMyMemberships } from '../data/api'
import { rememberPerson } from '../lib/device'
import { errorMessage } from '../lib/errors'
import type { Member, Restaurant } from '../types'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) {
      setMember(null)
      setRestaurant(null)
      setIsManager(false)
      return
    }
    let live = true
    setLoading(true)
    setError(null)
    Promise.all([fetchMyMemberships(userId), fetchIsManager(userId)])
      .then(([rows, manager]) => {
        if (!live) return
        // ponytail: first active restaurant only; add a picker when someone works at two.
        const first = rows[0] ?? null
        setMember(first)
        setRestaurant(first?.restaurants ?? null)
        setIsManager(manager)
        if (first) rememberPerson({ email: first.email, name: first.name })
      })
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [userId, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        member,
        restaurant,
        isManager,
        loading: !ready || loading,
        error,
        reload,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
