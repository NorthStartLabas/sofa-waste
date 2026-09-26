import {
  admin,
  caller,
  cors,
  escapeHtml,
  json,
  pinPassword,
  randomPin,
  sendMail,
} from '../_shared/common.ts'
import { pinMail } from './pinMail.ts'

/**
 * Creating a person, resetting a PIN and deleting a person: the things that
 * need the auth admin API. Name, role and active are plain updates on `members` under RLS.
 *
 * Both reply with the PIN itself when it could not be emailed (no Resend key
 * yet, or Resend refused), so an admin can hand it over in person. It is a
 * temporary PIN that must be changed at first sign-in.
 *
 * Bootstrap: a restaurant with no members at all accepts one `create` with the
 * BOOTSTRAP_SECRET header instead of a signed-in admin, and makes that person
 * admin and app manager. Unset the secret afterwards.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const db = admin()
  const body = await req.json().catch(() => ({}))
  const restaurantId = typeof body.restaurant_id === 'string' ? body.restaurant_id : ''
  if (!restaurantId) return json({ error: 'invalid' }, 400)

  let bootstrap = false
  const userId = await caller(req, db)
  if (userId) {
    const { data: me } = await db
      .from('members')
      .select('role')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle()
    if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403)
  } else {
    const secret = Deno.env.get('BOOTSTRAP_SECRET')
    const { count } = await db
      .from('members')
      .select('user_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    if (
      !secret ||
      req.headers.get('x-bootstrap') !== secret ||
      count !== 0 ||
      body.action !== 'create'
    ) {
      return json({ error: 'unauthorized' }, 401)
    }
    bootstrap = true
  }

  const { data: restaurant } = await db
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .single()
  if (!restaurant) return json({ error: 'invalid' }, 400)

  if (body.action === 'create') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const role = bootstrap ? 'admin' : body.role
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !name ||
      !['cook', 'chef', 'admin'].includes(role)
    ) {
      return json({ error: 'invalid' }, 400)
    }

    const { data: created, error } = await db.auth.admin.createUser({
      email,
      // Replaced right below; the real one is derived from the new user's id.
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
    })
    if (error || !created.user) {
      return json(
        { error: /already|registered|exists/i.test(error?.message ?? '') ? 'exists' : 'server' },
        400,
      )
    }
    const id = created.user.id
    const pin = randomPin()
    await db.auth.admin.updateUserById(id, { password: await pinPassword(id, pin) })

    const { error: memberError } = await db.from('members').insert({
      restaurant_id: restaurantId,
      user_id: id,
      name,
      email,
      role,
      must_change_pin: true,
    })
    if (memberError) {
      await db.auth.admin.deleteUser(id)
      return json({ error: 'server' }, 500)
    }
    if (bootstrap) await db.from('app_managers').insert({ user_id: id })

    const emailed = await sendMail(
      [email],
      'Je pincode voor de SOFA keuken-apps',
      pinMail(name, pin, restaurant.name),
    )
    // Bootstrap answers with the PIN even when it was emailed: whoever holds the
    // one-time secret is the person being set up, and the mail may be quarantined.
    return json(emailed && !bootstrap ? { ok: true, emailed } : { ok: true, emailed, pin })
  }

  if (body.action === 'reset') {
    const target = typeof body.user_id === 'string' ? body.user_id : ''
    const { data: member } = await db
      .from('members')
      .select('name, email')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', target)
      .maybeSingle()
    if (!member) return json({ error: 'invalid' }, 400)

    const pin = randomPin()
    const { error } = await db.auth.admin.updateUserById(target, {
      password: await pinPassword(target, pin),
    })
    if (error) return json({ error: 'server' }, 500)
    await db
      .from('members')
      .update({ must_change_pin: true })
      .eq('restaurant_id', restaurantId)
      .eq('user_id', target)

    const emailed = await sendMail(
      [member.email],
      'Je nieuwe pincode voor de SOFA keuken-apps',
      pinMail(member.name, pin, restaurant.name),
    )
    return json(emailed ? { ok: true, emailed } : { ok: true, emailed, pin })
  }

  if (body.action === 'delete') {
    const target = typeof body.user_id === 'string' ? body.user_id : ''
    if (target === userId) return json({ error: 'self' }, 400)
    const { data: member } = await db
      .from('members')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', target)
      .maybeSingle()
    if (!member) return json({ error: 'invalid' }, 400)

    // Someone who also works at another restaurant keeps their login there;
    // only this membership goes. Otherwise the login goes too, which frees the
    // email to be added again. Their entries stay, under the name they had.
    const { count } = await db
      .from('members')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', target)
    const { error } =
      (count ?? 0) > 1
        ? await db.from('members').delete().eq('restaurant_id', restaurantId).eq('user_id', target)
        : await db.auth.admin.deleteUser(target)
    if (error) return json({ error: 'server' }, 500)
    return json({ ok: true })
  }

  return json({ error: 'invalid' }, 400)
})
