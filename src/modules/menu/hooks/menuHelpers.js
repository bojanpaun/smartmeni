// Čiste helper funkcije za meni — BEZ supabase importa, da ih Vitest može testirati
// bez instanciranja klijenta (CI nema VITE_SUPABASE_* → createClient baca na importu).

// Grupiše stavke menija po category_id → { [categoryId]: Item[] }.
export function groupByCategory(items) {
  const map = {}
  for (const it of items || []) {
    if (!map[it.category_id]) map[it.category_id] = []
    map[it.category_id].push(it)
  }
  return map
}

// Ukupna cijena korpe, zaokruženo na 2 decimale (izbjegava float repove).
export function cartTotal(cart) {
  const sum = (cart || []).reduce(
    (s, c) => s + (Number(c.price) || 0) * (Number(c.qty) || 0), 0)
  return Math.round(sum * 100) / 100
}
