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

// Procenat popusta iz stvarne (price) i referentne (compareAtPrice) cijene.
// Vraća zaokružen cijeli broj (npr. 20 za −20%) ili null kad nema validnog popusta
// (referentna fali, ≤ stvarna, ili stvarna nije pozitivna).
export function discountPercent(price, compareAtPrice) {
  const p = Number(price)
  const c = Number(compareAtPrice)
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c <= p) return null
  return Math.round((1 - p / c) * 100)
}

// Izvodi referentnu ("staru") cijenu iz % popusta: compare = price / (1 − pct/100).
// Koristi admin forma kad korisnik unosi popust u procentima umjesto stare cijene.
// Vraća zaokruženo na 2 decimale ili null za nevalidan ulaz (pct van opsega 1..99).
export function compareFromPercent(price, pct) {
  const p = Number(price)
  const d = Number(pct)
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(d) || d <= 0 || d >= 100) return null
  return Math.round((p / (1 - d / 100)) * 100) / 100
}

// Sortira artikle za javni meni: sponzorisani prvi, pa po sort_order (stabilno).
// Ulaz je već učitan po sort_order; ovo samo diže sponzorisane na vrh kategorije.
export function sortMenuItems(items) {
  return [...(items || [])].sort((a, b) => {
    const sp = (b.is_sponsored ? 1 : 0) - (a.is_sponsored ? 1 : 0)
    if (sp !== 0) return sp
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

// Zbir cijena artikala u paketu (price × quantity), zaokružen na 2 decimale.
// rows = [{ menu_item_id, quantity }], priceById = { [id]: price }.
export function bundleItemsTotal(rows, priceById) {
  const sum = (rows || []).reduce((s, r) => {
    const p = Number(priceById?.[r.menu_item_id])
    const q = Number(r.quantity) || 0
    return s + (Number.isFinite(p) ? p : 0) * q
  }, 0)
  return Math.round(sum * 100) / 100
}

// Izvodi cijenu paketa iz % popusta na zbir: total × (1 − pct/100).
// Koristi admin forma kad korisnik unosi popust paketa u procentima umjesto fiksne cijene.
// Vraća zaokruženo na 2 decimale ili null za nevalidan ulaz (pct van opsega 1..99).
export function bundlePriceFromPercent(total, pct) {
  const t = Number(total)
  const d = Number(pct)
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(d) || d <= 0 || d >= 100) return null
  return Math.round(t * (1 - d / 100) * 100) / 100
}

// Da li je promo entitet "uživo" (prikazuje se gostu): aktivan i unutar perioda važenja.
// Generičko za pakete I reklame partnera (oba imaju is_active/valid_from/valid_until).
// today može biti Date ili 'YYYY-MM-DD'; valid_from/valid_until su date stringovi (ili null).
export function isPromoLive(x, today = new Date()) {
  if (!x || !x.is_active) return false
  const ymd = today instanceof Date ? today.toISOString().slice(0, 10) : String(today).slice(0, 10)
  if (x.valid_from && x.valid_from > ymd) return false
  if (x.valid_until && x.valid_until < ymd) return false
  return true
}

// Alias za pakete (čitljivost na pozivnom mjestu).
export function isBundleLive(b, today = new Date()) {
  return isPromoLive(b, today)
}
