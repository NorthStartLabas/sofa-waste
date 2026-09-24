import { createClient } from '@supabase/supabase-js'

export const url = import.meta.env.VITE_SUPABASE_URL
export const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.')
}

export const supabase = createClient(url, key, {
  // No emailed auth links exist in this app, so nothing ever arrives in the URL.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

/**
 * Calls an edge function and hands back its status and JSON, rather than
 * functions.invoke's error object, because the screens branch on the body
 * (`locked` carries the time the lock ends).
 */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const { data: session } = await supabase.auth.getSession()
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T }
}
