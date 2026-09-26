import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const APP_URL = 'https://northstartlabas.github.io/sofa-waste/'
/** The ordering app. Same accounts and PINs, so the welcome email names both. */
export const ORDER_URL = 'https://northstartlabas.github.io/sofa-inventoriy/'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

/** Service-role client. Bypasses RLS: every caller check happens before it's used. */
export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Anon client, for signing in the way a browser would. */
export function anon(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * The Supabase password behind a PIN. A 4-digit PIN is 10,000 guesses; this is
 * 256 bits nobody can guess without PIN_PEPPER, so GoTrue can't be brute-forced
 * around the lockout in pin-login. Never change PIN_PEPPER: every PIN stops
 * working.
 */
export async function pinPassword(userId: string, pin: string): Promise<string> {
  const pepper = Deno.env.get('PIN_PEPPER')
  if (!pepper || pepper.length < 32) throw new Error('PIN_PEPPER is not set')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${userId}:${pin}`))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const PIN_SHAPE = /^\d{4}$/

/** 0000, 1111, 1234, 9876 and friends: the first things anyone tries. */
export function isTrivialPin(pin: string): boolean {
  const d = [...pin].map(Number)
  const same = d.every((x) => x === d[0])
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1)
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1)
  return same || up || down
}

export function randomPin(): string {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0]
    // Rejection sampling keeps every PIN equally likely.
    if (n >= 4294960000) continue
    const pin = String(n % 10000).padStart(4, '0')
    if (!isTrivialPin(pin)) return pin
  }
}

/** Sends through Resend. False when no key is set yet, so callers can fall back. */
export async function sendMail(to: string[], subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key || to.length === 0) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Must be on the domain verified in Resend (updates.northstarlabs.nl).
      // Not "liviu@": mail from liviu@ to liviu@ via an unknown server is what
      // Microsoft 365 treats as impersonation and quarantines. Replies still
      // reach a real inbox.
      from: Deno.env.get('MAIL_FROM') ?? 'SOFA Verspilling <verspilling@updates.northstarlabs.nl>',
      reply_to: Deno.env.get('MAIL_REPLY_TO') ?? 'liviu@northstarlabs.nl',
      to,
      subject,
      html,
      // HTML-only mail scores worse with spam filters.
      text: html
        .replace(/<(br|\/p|\/tr|hr)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/\n\s*\n+/g, '\n\n')
        .trim(),
    }),
  })
  if (!res.ok) console.error('resend', res.status, await res.text())
  return res.ok
}

/** The signed-in user behind the request, or null. */
export async function caller(req: Request, db: SupabaseClient): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data.user?.id ?? null
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
