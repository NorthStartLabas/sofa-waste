import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { fetchCatalog, type Catalog } from './api'
import { CatalogContext } from './catalogContext'

const empty: Catalog = { items: [], stations: [], suppliers: [], locations: [], recipeLines: [] }

/**
 * One fetch of the whole catalog, shared by the log screen and the editors.
 * Re-read after every edit and whenever the app comes back into view, so a
 * price the chef just changed is the price the next entry is shown at. (The
 * cost actually saved is always the server's, at insert time.)
 */
export function CatalogProvider({
  restaurantId,
  children,
}: {
  restaurantId: string
  children: ReactNode
}) {
  const [catalog, setCatalog] = useState<Catalog>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setCatalog(await fetchCatalog(restaurantId))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void reload()
    const onVisible = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return (
    <CatalogContext.Provider value={{ ...catalog, loading, error, reload }}>
      {children}
    </CatalogContext.Provider>
  )
}
