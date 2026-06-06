/**
 * Punjenje slika za biblioteku recepata (recipe_library.image_url).
 *
 * Za svaki recept (po name_en) pretraži Pexels, skine najbolju fotografiju i
 * rehostuje je u Supabase Storage bucket 'recipe-library', pa upiše javni URL.
 * Pexels licenca: besplatno za komercijalnu upotrebu, bez obavezne atribucije.
 *
 * "Kombinovano": po defaultu obrađuje SAMO ALLOWLIST (sve kafe + prepoznatljivi
 * kokteli). Ostalo ostaje na emoji ikoni. Postavi ALLOWLIST = null za sve.
 *
 * Pokretanje (PowerShell):
 *   $env:SUPABASE_URL="https://twtgzrngzretcvyeqpxm.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key iz Supabase > Settings > API>"
 *   $env:PEXELS_API_KEY="<besplatan key sa https://www.pexels.com/api/>"
 *   node scripts/seed_recipe_images.mjs
 *
 * Idempotentno: preskače recepte koji već imaju image_url (osim uz --force).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PEXELS_KEY   = process.env.PEXELS_API_KEY
const FORCE        = process.argv.includes('--force')
const BUCKET       = 'recipe-library'

// Kombinovano: kafe (sve) + prepoznatljivi kokteli. null = svi recepti.
const ALLOWLIST = new Set([
  // kafa
  'espresso','doppio','ristretto','lungo','macchiato','cortado','cappuccino',
  'flat_white','caffe_latte','latte_macchiato','americano','mocha',
  'caramel_macchiato','affogato','irish_coffee','vienna_coffee','cold_brew','iced_latte',
  // prepoznatljivi kokteli
  'mojito','margarita','daiquiri','negroni','old_fashioned','manhattan','cosmopolitan',
  'mai_tai','pina_colada','whiskey_sour','aperol_spritz','gin_tonic','cuba_libre',
  'bloody_mary','espresso_martini','moscow_mule','mimosa','tequila_sunrise','white_russian',
])

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Nedostaje SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1)
}
if (!PEXELS_KEY) {
  console.error('Nedostaje PEXELS_API_KEY (besplatan: https://www.pexels.com/api/).'); process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function searchPexels(query) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } })
  if (!res.ok) throw new Error(`Pexels ${res.status}`)
  const data = await res.json()
  return data.photos?.[0]?.src?.large || data.photos?.[0]?.src?.original || null
}

async function run() {
  const { data: recipes, error } = await sb
    .from('recipe_library')
    .select('id, name_en, name, category, image_url')
    .order('sort_order')
  if (error) { console.error('DB greška:', error.message); process.exit(1) }

  let done = 0, skipped = 0, failed = 0
  for (const r of recipes) {
    if (ALLOWLIST && !ALLOWLIST.has(r.id)) { skipped++; continue }
    if (r.image_url && !FORCE) { skipped++; continue }

    const subject = r.name_en || r.name
    const query = r.category === 'coffee' ? `${subject} coffee drink` : `${subject} cocktail drink`
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
      const { error: updErr } = await sb.from('recipe_library')
        .update({ image_url: pub.publicUrl }).eq('id', r.id)
      if (updErr) throw updErr

      console.log(`✓ ${r.id} → ${pub.publicUrl}`)
      done++
      await sleep(350) // blag rate-limit prema Pexels
    } catch (e) {
      console.warn(`✗ ${r.id}: ${e.message}`); failed++
    }
  }
  console.log(`\nGotovo. Upisano: ${done}, preskočeno: ${skipped}, neuspjelo: ${failed}.`)
}

run()
