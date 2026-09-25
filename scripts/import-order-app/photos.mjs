import { sql, NEW, OLD, serviceKey } from './lib.mjs'
const key = await serviceKey(NEW)
const folders = (await sql(NEW, 'select photo_path from items where photo_path is not null')).map(
  (r) => r.photo_path,
)
let copied = 0,
  failed = []
async function copy(path) {
  const src = await fetch(
    `https://${OLD}.supabase.co/storage/v1/object/public/ingredient-photos/${path}`,
  )
  if (!src.ok) throw new Error(`read ${src.status}`)
  const type = src.headers.get('content-type') ?? 'image/webp'
  const res = await fetch(
    `https://${NEW}.supabase.co/storage/v1/object/ingredient-photos/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': type,
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000',
      },
      body: Buffer.from(await src.arrayBuffer()),
    },
  )
  if (!res.ok) throw new Error(`write ${res.status} ${(await res.text()).slice(0, 120)}`)
}
const jobs = folders.flatMap((f) => [`${f}/full`, `${f}/thumb`])
for (let i = 0; i < jobs.length; i += 8) {
  await Promise.all(
    jobs.slice(i, i + 8).map((p) =>
      copy(p).then(
        () => copied++,
        (e) => failed.push(`${p}: ${e.message}`),
      ),
    ),
  )
}
console.log(
  JSON.stringify({
    objects: jobs.length,
    copied,
    failed: failed.slice(0, 5),
    failedCount: failed.length,
  }),
)
