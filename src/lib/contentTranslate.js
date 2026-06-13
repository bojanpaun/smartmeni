import { supabase } from './supabase'

// supabase-js na ne-2xx vrati generičku grešku, a pravo tijelo ({error:...}) krije
// u error.context (Response). Ovo izvuče stvarnu poruku da je možemo prikazati.
async function invokeTranslate(body) {
  const { data, error } = await supabase.functions.invoke('translate-content', { body })
  if (error) {
    let detail = error.message || 'Edge greška'
    try { const b = await error.context?.json?.(); if (b?.error) detail = b.error } catch { /* ignore */ }
    throw new Error(detail)
  }
  return data
}

// Okida AI prevod tenant-sadržaja: zove edge funkciju `translate-content` koja
// prevede zadate stavke na 6 ciljnih jezika i keširaju se u content_translations.
// Edge sam preskače svjež (isti source_hash) i is_override → bezbjedno za poziv na
// svako snimanje. Pozivalac obično NE blokira UI (fire-and-forget): prevodi se
// pojave gostu čim stignu; do tada fallback na izvor.
//
// items: [{ entity_type, entity_id, field, text }] — text je IZVOR (crnogorski).
export async function translateContent(restaurantId, items, langs) {
  const clean = (items || []).filter(
    (it) => it && it.entity_type && it.entity_id && it.field && typeof it.text === 'string' && it.text.trim(),
  )
  if (!restaurantId || clean.length === 0) return { translated: 0, skipped: 0 }
  return invokeTranslate({ restaurant_id: restaurantId, items: clean, langs })
}

// Backfill: edge funkcija sama učita SVE menu_items (uklj. skrivene) + kategorije
// tenanta (service_role) i prevede neprevedeno. Koristi superadmin za zatečene
// menije. Vraća { translated, skipped }. Smije ga zvati vlasnik ili superadmin.
export async function backfillTenant(restaurantId, langs) {
  if (!restaurantId) return { translated: 0, skipped: 0 }
  return invokeTranslate({ restaurant_id: restaurantId, backfill: true, langs })
}

// Pomoćnik: items niz za razlog odbijanja narudžbe. Izvor je tekst koji je konobar
// odabrao/unio (crnogorski); keširaju se prevodi po konkretnoj narudžbi (entity_id =
// order.id) pa ih OrderTrackerPage čita na gostov jezik. entity_type='order'.
export function orderRejectionFields(orderId, message) {
  if (!orderId || typeof message !== 'string' || !message.trim()) return []
  return [{ entity_type: 'order', entity_id: orderId, field: 'rejection_message', text: message }]
}

// Pomoćnik: napravi items niz iz jednog menu_item reda (name + description).
export function menuItemFields(item) {
  const out = []
  if (item?.id && item.name?.trim()) out.push({ entity_type: 'menu_item', entity_id: item.id, field: 'name', text: item.name })
  if (item?.id && item.description?.trim()) out.push({ entity_type: 'menu_item', entity_id: item.id, field: 'description', text: item.description })
  return out
}

// ── Landing stranice (restaurant/hotel) ───────────────────────────────────────
// Blokovi su jedinstveni po `type` po stranici (editor ih čuva kao {type,enabled,data}
// bez id-a, dnd/keys idu po `type`). Zato je entity model:
//   entity_type = 'landing_block', entity_id = restaurantId,
//   field = `${pageType}.${blockType}.${key}` (nizovi: `…arr.${i}.${subkey}`).
// pageType ('restaurant'|'hotel') u putanji razdvaja dvije landing stranice istog
// tenanta. Prevode se SAMO prozna polja; URL-ovi/slike/cijene/imena-osoba/adresa/
// telefon/email ostaju izvor. `restaurants.description` (opis objekta) ide zasebno
// kao entity_type='restaurant'.
const LANDING_FIELDS = {
  restaurant: {
    hero:            ['title', 'subtitle'],
    story:           ['text'],
    video:           ['title'],
    cta_banner:      ['title', 'subtitle', 'btn_text'],
    reservation_cta: ['text', 'subtitle'],
    hours_location:  ['hours'],
    specials:        { array: 'specials', fields: ['name', 'description'] },
    reviews:         { array: 'reviews', fields: ['text'] },
  },
  hotel: {
    hero:       ['title', 'subtitle'],
    about:      ['text'],
    amenities:  { lines: 'items' },
    video:      ['title'],
    cta_banner: ['title', 'subtitle', 'btn_text'],
    contact:    ['hours'],
    reviews:    { array: 'reviews', fields: ['text'] },
    faq:        { array: 'faq', fields: ['question', 'answer'] },
  },
}

// Gradi stabilnu putanju polja (isti oblik pri pisanju i čitanju — bez drift-a).
export function landingFieldPath(pageType, blockType, ...rest) {
  return [pageType, blockType, ...rest].join('.')
}

// items niz za sva prozna polja jedne landing stranice (svi blokovi, bez obzira na
// enabled — i isključeni blok može kasnije biti uključen). pageType: 'restaurant'|'hotel'.
export function landingBlockFields(restaurantId, pageType, blocks) {
  const cfg = LANDING_FIELDS[pageType]
  if (!restaurantId || !cfg || !Array.isArray(blocks)) return []
  const out = []
  const push = (field, text) => {
    if (typeof text === 'string' && text.trim()) {
      out.push({ entity_type: 'landing_block', entity_id: restaurantId, field, text })
    }
  }
  for (const block of blocks) {
    const spec = cfg[block?.type]
    const data = block?.data
    if (!spec || !data) continue
    if (Array.isArray(spec)) {
      for (const key of spec) push(landingFieldPath(pageType, block.type, key), data[key])
    } else if (spec.lines) {
      // Lista odvojena novim redom (npr. amenities) → prevod po liniji (indeksirano),
      // jer prevod cijelog bloba ne garantuje očuvanje prelomа.
      const lines = typeof data[spec.lines] === 'string' ? data[spec.lines].split('\n').map(s => s.trim()).filter(Boolean) : []
      lines.forEach((line, i) => push(landingFieldPath(pageType, block.type, spec.lines, i), line))
    } else {
      const arr = Array.isArray(data[spec.array]) ? data[spec.array] : []
      arr.forEach((item, i) => {
        for (const key of spec.fields) push(landingFieldPath(pageType, block.type, spec.array, i, key), item?.[key])
      })
    }
  }
  return out
}

// Pomoćnik: items niz za opis objekta (restaurants.description). entity_type='restaurant'.
export function restaurantDescriptionFields(restaurantId, description) {
  if (!restaurantId || typeof description !== 'string' || !description.trim()) return []
  return [{ entity_type: 'restaurant', entity_id: restaurantId, field: 'description', text: description }]
}
