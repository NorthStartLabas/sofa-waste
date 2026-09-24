import { createContext, useContext } from 'react'
import type { Catalog } from './api'

export type CatalogState = Catalog & {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export const CatalogContext = createContext<CatalogState | null>(null)

export function useCatalog(): CatalogState {
  const c = useContext(CatalogContext)
  if (!c) throw new Error('useCatalog outside CatalogProvider')
  return c
}
