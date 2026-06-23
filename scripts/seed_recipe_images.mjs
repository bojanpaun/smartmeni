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

// null = svi recepti (kafa, kokteli, bezalkoholna, topli, hrana, salate, doručak,
// deserti). Beverage stavke (pivo/vino/žestoko) Pexels obično ne pogađa dobro —
// po potrebi ih ručno postavi kroz /superadmin/recipes. Postavi Set([...]) da
// ograničiš na konkretne ID-eve.
const ALLOWLIST = null

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Nedostaje SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1)
}
if (!PEXELS_KEY) {
  console.error('Nedostaje PEXELS_API_KEY (besplatan: https://www.pexels.com/api/).'); process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const IMG_WIDTH = 600 // dovoljno za kartice/modal (uklj. retina), mali fajl

// page omogućava varijaciju: ista generička pretraga (npr. "cold beer in glass")
// uz rastući page vraća različite fotografije pa se slike ne ponavljaju.
async function searchPexels(query, page = 1) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } })
  if (!res.ok) throw new Error(`Pexels ${res.status}`)
  const data = await res.json()
  const orig = data.photos?.[0]?.src?.original
  // Pexels podržava resize/kompresiju kroz query params na original URL-u.
  if (orig) return `${orig}?auto=compress&cs=tinysrgb&w=${IMG_WIDTH}`
  return data.photos?.[0]?.src?.large || null
}

// Pexels upit po receptu. Za beverage (pivo/vino/žestoko) brendovi/sorte se ne
// pogađaju po imenu, pa koristimo generičan vizuelni pojam po pod-tipu (uz page
// rotaciju za raznolikost). Za ostalo: naziv (EN) + sufiks po kategoriji.
function buildQuery(r) {
  const hay = `${r.name} ${r.name_en || ''}`.toLowerCase()
  if (r.category === 'beverage') {
    if (/(pivo|beer|lager|stout|radler|guinness|ipa)/.test(hay)) return 'cold beer in glass'
    if (/(vino|wine|vranac|krsta|rosé|rose|pjenu|sparkling|graševina|grasevina|žilavka|zilavka|blatina|plavac|malvazija|prokupac|tamjanika|bevanda|gemiš|gemis)/.test(hay)) return 'glass of wine'
    return 'glass of brandy spirit drink' // rakije, žestoko, likeri, aperitivi
  }
  const subject = r.name_en || r.name
  const suffix = {
    coffee: 'coffee drink', cocktail: 'cocktail drink', soft: 'fresh drink',
    hot: 'hot tea drink', beverage: 'drink',
    food: 'food dish', salad: 'food', breakfast: 'breakfast food', dessert: 'dessert',
    soup: 'soup bowl', side: 'food side dish', kids: 'food', vegetarian: 'vegetarian food',
  }[r.category] || 'food'
  return `${subject} ${suffix}`
}

async function run() {
  const { data: recipes, error } = await sb
    .from('recipe_library')
    .select('id, name_en, name, category, image_url')
    .order('sort_order')
  if (error) { console.error('DB greška:', error.message); process.exit(1) }

  let done = 0, skipped = 0, failed = 0
  const pageCounter = {} // query -> koliko puta je korišten (za page rotaciju)
  for (const r of recipes) {
    if (ALLOWLIST && !ALLOWLIST.has(r.id)) { skipped++; continue }
    // Nikad ne gazi ručno postavljene slike (superadmin UI dodaje ?v= u URL).
    if (r.image_url && r.image_url.includes('?v=')) { skipped++; continue }
    // Bez --force: samo popuni gdje fali. Sa --force: re-fetch (npr. smanjenje).
    if (r.image_url && !FORCE) { skipped++; continue }

    const query = buildQuery(r)
    const page = (pageCounter[query] = (pageCounter[query] || 0) + 1)
    try {
      const photoUrl = await searchPexels(query, page)
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
