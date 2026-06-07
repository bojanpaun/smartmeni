/**
 * seed_treatment_images.mjs
 * ---------------------------------------------------------------------------
 * Za svaki tretman u spa_treatment_library povlači sliku sa Pexels-a, rehostuje
 * je u Supabase Storage bucket 'spa-library' (kreira ga ako ne postoji, javni),
 * pa upiše javni URL u image_url. Isti obrazac kao seed_recipe_images.mjs.
 *
 * Pokretanje (PowerShell):
 *   $env:SUPABASE_URL="https://twtgzrngzretcvyeqpxm.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key iz Supabase > Settings > API>"
 *   $env:PEXELS_API_KEY="<besplatan key sa https://www.pexels.com/api/>"
 *   node scripts/seed_treatment_images.mjs            # popuni gdje fali
 *   node scripts/seed_treatment_images.mjs --force    # re-fetch sve
 *
 * NE commituj ključeve. Service role i Pexels key drži samo u env varijablama.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PEXELS_KEY   = process.env.PEXELS_API_KEY
const FORCE        = process.argv.includes('--force')
const BUCKET       = 'spa-library'
const IMG_WIDTH    = 600

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Nedostaje SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1)
}
if (!PEXELS_KEY) {
  console.error('Nedostaje PEXELS_API_KEY (besplatan: https://www.pexels.com/api/).'); process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function ensureBucket() {
  const { error } = await sb.storage.createBucket(BUCKET, { public: true })
  if (error && !/already exists/i.test(error.message)) {
    console.warn(`Bucket upozorenje: ${error.message}`)
  }
}

async function searchPexels(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } })
  if (!res.ok) throw new Error(`Pexels ${res.status}`)
  const data = await res.json()
  const orig = data.photos?.[0]?.src?.original
  if (orig) return `${orig}?auto=compress&cs=tinysrgb&w=${IMG_WIDTH}`
  return data.photos?.[0]?.src?.large || null
}

const SUFFIX = {
  massage:  'massage spa',
  facial:   'facial skincare treatment',
  body:     'spa body treatment',
  nail:     'manicure pedicure',
  wellness: 'sauna spa wellness',
  group:    'spa wellness',
}

async function run() {
  await ensureBucket()

  const { data: rows, error } = await sb
    .from('spa_treatment_library')
    .select('id, name, name_en, category, image_url')
    .order('sort_order')
  if (error) { console.error('DB greška:', error.message); process.exit(1) }

  let done = 0, skipped = 0, failed = 0
  for (const r of rows) {
    if (r.image_url && r.image_url.includes('?v=')) { skipped++; continue } // ručno postavljena
    if (r.image_url && !FORCE) { skipped++; continue }

    const subject = r.name_en || r.name
    const query = `${subject} ${SUFFIX[r.category] || 'spa'}`
    try {
      const photoUrl = await searchPexels(query)
      if (!photoUrl) { console.warn(`⊘ ${r.id}: nema rezultata za "${query}"`); failed++; continue }

      const imgRes = await fetch(photoUrl)
      if (!imgRes.ok) throw new Error(`download ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())

      const path = `${r.id}.jpg`
      const { error: upErr } = await sb.storage.from(BUCKET)
        .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
      const { error: updErr } = await sb.from('spa_treatment_library')
        .update({ image_url: pub.publicUrl }).eq('id', r.id)
      if (updErr) throw updErr

      console.log(`✓ ${r.id} → ${pub.publicUrl}`)
      done++
      await sleep(350)
    } catch (e) {
      console.warn(`✗ ${r.id}: ${e.message}`); failed++
    }
  }
  console.log(`\nGotovo. Upisano: ${done}, preskočeno: ${skipped}, neuspjelo: ${failed}.`)
}

run()
