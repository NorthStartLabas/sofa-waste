import { admin, anon, cors, json, pinPassword, PIN_SHAPE } from '../_shared/common.ts'

/** Wrong PINs per account before it locks. The lock doubles each time, 15 min to a day. */
const PER_ACCOUNT = 5
/** Wrong PINs from one address before it locks, whichever accounts they aimed at. */
const PER_IP = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const pin = typeof body.pin === 'string' ? body.pin : ''
  if (!email || !PIN_SHAPE.test(pin)) return json({ error: 'invalid' }, 400)

  const db = admin()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'

  // Each call claims its attempt before the PIN is checked, so a burst of
  // parallel guesses can't all get in ahead of the first failure.
  for (const [key, max] of [
    [`ip:${ip}`, PER_IP],
    [`email:${email}`, PER_ACCOUNT],
  ] as const) {
    const { data: until, error } = await db.rpc('pin_attempt', { p_key: key, p_max: max })
    if (error) return json({ error: 'server' }, 500)
    if (until) return json({ error: 'locked', until }, 429)
  }

  const { data: member } = await db
    .from('members')
    .select('user_id')
    // Stored lowercase by admin-users. eq, not ilike: `%` in an email is a wildcard to ilike.
    .eq('email', email)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  // Same answer for "no such person" and "wrong PIN": the screen doesn't tell
  // a stranger which emails have accounts.
  if (!member) return json({ error: 'invalid' }, 401)

  const { data, error } = await anon().auth.signInWithPassword({
    email,
    password: await pinPassword(member.user_id, pin),
  })
  if (error || !data.session) return json({ error: 'invalid' }, 401)

  await db.rpc('pin_attempt_ok', { p_key: `email:${email}` })
  await db.rpc('pin_attempt_ok', { p_key: `ip:${ip}` })
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
})
