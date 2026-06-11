#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// i18n key-parity gate (CI hard gate).
// Referenca = `me`. Za SVAKI postojeći jezik-folder pod src/i18n/locales/,
// svaki namespace mora imati TAČNO iste (duboke) ključeve kao `me`. Prijavljuje
// nedostajuće i viška ključeve. Tako se sprečava „pola prevedeno" stanje.
//
// Jezici koji još nemaju folder se NE provjeravaju (runtime fallback na `me`) —
// gate pazi samo da svaki dodati jezik bude kompletan. Pokretanje: npm run i18n:check
// ════════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales')
const REFERENCE = 'me'

// i18next/CLDR plural sufiksi — različiti jezici imaju različite kategorije
// (engleski: one/other; slovenski: one/few/many/other). Poredimo BAZNI ključ
// (bez plural sufiksa) da ne bismo lažno prijavljivali plural razlike.
const stripPlural = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '')

// Spljošti objekat u skup baznih "a.b.c" ključeva (samo listovi, bez plural sufiksa).
function flatKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatKeys(v, key, out)
    else out.add(stripPlural(key))
  }
  return out
}

function loadNs(lang, ns) {
  const p = join(ROOT, lang, `${ns}.json`)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

if (!existsSync(ROOT)) {
  console.error(`i18n-check: locales dir not found: ${ROOT}`)
  process.exit(1)
}

const langs = readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory())
if (!langs.includes(REFERENCE)) {
  console.error(`i18n-check: reference language "${REFERENCE}" folder missing`)
  process.exit(1)
}

// Namespace-i koje referenca (me) definiše.
const refNamespaces = readdirSync(join(ROOT, REFERENCE))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))

const refKeys = Object.fromEntries(
  refNamespaces.map((ns) => [ns, flatKeys(loadNs(REFERENCE, ns))]),
)

const errors = []
for (const lang of langs) {
  if (lang === REFERENCE) continue
  for (const ns of refNamespaces) {
    const data = loadNs(lang, ns)
    if (data === null) {
      errors.push(`[${lang}] nedostaje namespace fajl: ${ns}.json`)
      continue
    }
    const keys = flatKeys(data)
    const ref = refKeys[ns]
    const missing = [...ref].filter((k) => !keys.has(k))
    const extra = [...keys].filter((k) => !ref.has(k))
    if (missing.length) errors.push(`[${lang}/${ns}] nedostaju ključevi: ${missing.join(', ')}`)
    if (extra.length) errors.push(`[${lang}/${ns}] višak ključeva (nema u me): ${extra.join(', ')}`)
  }
}

if (errors.length) {
  console.error('i18n-check: NEUSKLAĐENI prevodi:\n' + errors.map((e) => '  • ' + e).join('\n'))
  process.exit(1)
}
console.log(`i18n-check: OK — ${langs.length} jezik(a), ${refNamespaces.length} namespace(a) usklađeno sa "${REFERENCE}".`)
