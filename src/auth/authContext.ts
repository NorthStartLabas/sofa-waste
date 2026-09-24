import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Member, Restaurant } from '../types'

export type Auth = {
  session: Session | null
  /** Null while loading, and for an account with no active membership. */
  member: Member | null
  restaurant: Restaurant | null
  isManager: boolean
  loading: boolean
  error: string | null
  reload: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const a = useContext(AuthContext)
  if (!a) throw new Error('useAuth outside AuthProvider')
  return a
}

/** The signed-in member. Only for screens behind the gate, where one always exists. */
export function useMember() {
  const { member, restaurant, isManager } = useAuth()
  if (!member || !restaurant) throw new Error('useMember before sign-in')
  const rank = { cook: 1, chef: 2, admin: 3 }[member.role]
  return { member, restaurant, isManager, isChef: rank >= 2, isAdmin: rank === 3 }
}
