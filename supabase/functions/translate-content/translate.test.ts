// ============================================================================
// Sloj Edge/Deno test — čista logika AI prevoda (translate.ts)
// ----------------------------------------------------------------------------
// Bez mreže: testira gradnju prompta, parsiranje Claude JSON-a (uklj. code fence
// i okolni tekst), filtriranje jezika i SHA-256 izvora. Najopasnija regresija:
// tiho krivo mapiranje index→entitet ili propušten/pogrešan jezik.
//
// Pokretanje:  deno test supabase/functions/translate-content/translate.test.ts
// ============================================================================

import { assertEquals, assert } from 'jsr:@std/assert'
import {
  buildPrompt, parseTranslations, extractJson, resolveLangs, sourceHash, landingFields, TARGET_LANGS,
  type SourceItem,
} from './translate.ts'

const ITEMS: SourceItem[] = [
  { entity_type: 'menu_item', entity_id: 'i1', field: 'name', text: 'Riblja čorba' },
  { entity_type: 'menu_item', entity_id: 'i2', field: 'name', text: 'Pršut' },
]

Deno.test('resolveLangs — default su svi ciljni, bez me', () => {
  assertEquals(resolveLangs(), [...TARGET_LANGS])
  assertEquals(resolveLangs([]), [...TARGET_LANGS])
  assertEquals(resolveLangs(['en', 'me', 'xx', 'ru']), ['en', 'ru']) // me i nepoznat odbačeni
})

Deno.test('buildPrompt — sadrži indekse, jezike i izvorni tekst', () => {
  const { system, user } = buildPrompt(ITEMS, ['en', 'sr'])
  assert(system.toLowerCase().includes('montenegrin'))
  assert(user.includes('0: "Riblja čorba"'))
  assert(user.includes('1: "Pršut"'))
  assert(user.includes('"en"') && user.includes('English'))
  assert(user.includes('Serbian'))
})

Deno.test('extractJson — skida code fence i okolni tekst', () => {
  assertEquals(extractJson('```json\n{"0":{"en":"x"}}\n```'), '{"0":{"en":"x"}}')
  assertEquals(extractJson('Evo:\n{"0":{"en":"x"}} hvala'), '{"0":{"en":"x"}}')
  assertEquals(extractJson('{"a":1}'), '{"a":1}')
})

Deno.test('parseTranslations — mapira index→entitet po jeziku', () => {
  const raw = '{"0":{"en":"Fish soup","sr":"Riblja čorba"},"1":{"en":"Prosciutto","sr":"Pršuta"}}'
  const rows = parseTranslations(raw, ITEMS, ['en', 'sr'])
  assertEquals(rows.length, 4)
  const en1 = rows.find((r) => r.entity_id === 'i1' && r.lang === 'en')
  assertEquals(en1?.value, 'Fish soup')
  assertEquals(en1?.entity_type, 'menu_item')
  assertEquals(en1?.field, 'name')
  const sr2 = rows.find((r) => r.entity_id === 'i2' && r.lang === 'sr')
  assertEquals(sr2?.value, 'Pršuta')
})

Deno.test('parseTranslations — preskače fale/prazne prevode, ne traži nezatražene jezike', () => {
  const raw = '{"0":{"en":"Fish soup","sr":"   ","hr":"Riblja juha"}}'
  const rows = parseTranslations(raw, ITEMS, ['en', 'sr']) // hr nije zatražen
  // i1: en validan, sr prazan (skip); i2 nema ključa (skip)
  assertEquals(rows.length, 1)
  assertEquals(rows[0].lang, 'en')
  assertEquals(rows[0].value, 'Fish soup')
})

Deno.test('parseTranslations — neispravan JSON baca grešku', () => {
  let threw = false
  try { parseTranslations('ovo nije json', ITEMS, ['en']) } catch { threw = true }
  assert(threw)
})

Deno.test('landingFields — skalar/niz/linije putanje, prazna preskočena', () => {
  const blocks = [
    { type: 'hero', data: { title: 'Ribar', subtitle: '', bg_image_url: 'x.jpg' } },
    { type: 'specials', data: { specials: [{ name: 'Brancin', description: 'Na žaru' }, { name: '' }] } },
  ]
  assertEquals(landingFields('restaurant', blocks), [
    { field: 'restaurant.hero.title', text: 'Ribar' },
    { field: 'restaurant.specials.specials.0.name', text: 'Brancin' },
    { field: 'restaurant.specials.specials.0.description', text: 'Na žaru' },
  ])
})

Deno.test('landingFields — amenities lista po liniji (trim/filter), nepoznat pageType prazno', () => {
  const blocks = [{ type: 'amenities', data: { items: 'Bazen\n  Wi-Fi  \n\nParking' } }]
  assertEquals(landingFields('hotel', blocks), [
    { field: 'hotel.amenities.items.0', text: 'Bazen' },
    { field: 'hotel.amenities.items.1', text: 'Wi-Fi' },
    { field: 'hotel.amenities.items.2', text: 'Parking' },
  ])
  assertEquals(landingFields('nepostoji', blocks), [])
})

Deno.test('sourceHash — stabilan i osjetljiv na promjenu', async () => {
  const a = await sourceHash('Pršut')
  const b = await sourceHash('Pršut')
  const c = await sourceHash('Pršuta')
  assertEquals(a, b)
  assert(a !== c)
  assertEquals(a.length, 64) // SHA-256 heks
})
