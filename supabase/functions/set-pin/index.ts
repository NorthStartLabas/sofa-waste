import {
  admin,
  caller,
  cors,
  isTrivialPin,
  json,
  pinPassword,
  PIN_SHAPE,
} from '../_shared/common.ts'

/** A signed-in person chooses their own PIN (forced after creation or a reset). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const db = admin()
  const userId = await caller(req, db)
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const { pin } = await req.json().catch(() => ({}))
  if (typeof pin !== 'string' || !PIN_SHAPE.test(pin)) return json({ error: 'invalid' }, 400)
  if (isTrivialPin(pin)) return json({ error: 'trivial' }, 400)

  const { error } = await db.auth.admin.updateUserById(userId, {
    password: await pinPassword(userId, pin),
  })
  if (error) return json({ error: 'server' }, 500)

  await db.from('members').update({ must_change_pin: false }).eq('user_id', userId)
  return json({ ok: true })
})
