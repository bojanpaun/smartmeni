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

// Pomoćnik: napravi items niz iz jednog menu_item reda (name + description).
export function menuItemFields(item) {
  const out = []
  if (item?.id && item.name?.trim()) out.push({ entity_type: 'menu_item', entity_id: item.id, field: 'name', text: item.name })
  if (item?.id && item.description?.trim()) out.push({ entity_type: 'menu_item', entity_id: item.id, field: 'description', text: item.description })
  return out
}
