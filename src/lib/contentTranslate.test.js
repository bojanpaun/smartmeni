// ============================================================================
// Sloj 3 — Unit testovi: contentTranslate (čisti helperi za AI prevod sadržaja)
// ----------------------------------------------------------------------------
// Testiraju se SAMO čiste funkcije koje grade `items` niz (entity_type/entity_id/
// field/text) — mreža (translateContent/invokeTranslate) se ne dira. supabase se
// mock-uje jer contentTranslate.js uvozi klijent na vrhu modula (bez env-a pukne).
//
// Pokretanje:  npm run test:unit
// ============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

const {
  orderRejectionFields, menuItemFields,
  landingFieldPath, landingBlockFields, restaurantDescriptionFields,
} = await import('./contentTranslate.js')

describe('orderRejectionFields', () => {
  const oid = '11111111-1111-1111-1111-111111111111'

  it('gradi jednu stavku za order/rejection_message', () => {
    expect(orderRejectionFields(oid, 'Nema sastojaka')).toEqual([
      { entity_type: 'order', entity_id: oid, field: 'rejection_message', text: 'Nema sastojaka' },
    ])
  })

  it('vraća prazno bez orderId-a', () => {
    expect(orderRejectionFields(null, 'X')).toEqual([])
  })

  it('vraća prazno za praznu/whitespace ili ne-string poruku', () => {
    expect(orderRejectionFields(oid, '')).toEqual([])
    expect(orderRejectionFields(oid, '   ')).toEqual([])
    expect(orderRejectionFields(oid, undefined)).toEqual([])
    expect(orderRejectionFields(oid, 42)).toEqual([])
  })
})

describe('menuItemFields', () => {
  const id = '22222222-2222-2222-2222-222222222222'

  it('uključuje name i description kad postoje', () => {
    expect(menuItemFields({ id, name: 'Pica', description: 'Sa sirom' })).toEqual([
      { entity_type: 'menu_item', entity_id: id, field: 'name', text: 'Pica' },
      { entity_type: 'menu_item', entity_id: id, field: 'description', text: 'Sa sirom' },
    ])
  })

  it('preskače prazno description i sve bez id-a', () => {
    expect(menuItemFields({ id, name: 'Pica', description: '  ' })).toEqual([
      { entity_type: 'menu_item', entity_id: id, field: 'name', text: 'Pica' },
    ])
    expect(menuItemFields({ name: 'Pica' })).toEqual([])
  })
})

describe('landingFieldPath', () => {
  it('spaja segmente tačkom (skalarno i indeksirano)', () => {
    expect(landingFieldPath('restaurant', 'hero', 'title')).toBe('restaurant.hero.title')
    expect(landingFieldPath('hotel', 'faq', 'faq', 2, 'answer')).toBe('hotel.faq.faq.2.answer')
  })
})

describe('landingBlockFields', () => {
  const rid = '33333333-3333-3333-3333-333333333333'

  it('skalarna polja bloka (hero) → putanje sa page_type prefiksom', () => {
    const blocks = [{ type: 'hero', enabled: true, data: { title: 'Ribar', subtitle: 'Od 1985', bg_image_url: 'x.jpg' } }]
    expect(landingBlockFields(rid, 'restaurant', blocks)).toEqual([
      { entity_type: 'landing_block', entity_id: rid, field: 'restaurant.hero.title', text: 'Ribar' },
      { entity_type: 'landing_block', entity_id: rid, field: 'restaurant.hero.subtitle', text: 'Od 1985' },
    ])
  })

  it('niz (specials) → indeksirane putanje, preskače prazna polja', () => {
    const blocks = [{ type: 'specials', enabled: true, data: { specials: [
      { name: 'Brancin', description: 'Na žaru', price: '20€' },
      { name: 'Lignje', description: '' },
    ] } }]
    expect(landingBlockFields(rid, 'restaurant', blocks)).toEqual([
      { entity_type: 'landing_block', entity_id: rid, field: 'restaurant.specials.specials.0.name', text: 'Brancin' },
      { entity_type: 'landing_block', entity_id: rid, field: 'restaurant.specials.specials.0.description', text: 'Na žaru' },
      { entity_type: 'landing_block', entity_id: rid, field: 'restaurant.specials.specials.1.name', text: 'Lignje' },
    ])
  })

  it('lista odvojena novim redom (amenities) → po liniji, trim + filter praznih', () => {
    const blocks = [{ type: 'amenities', enabled: true, data: { items: 'Bazen\n  Wi-Fi  \n\nParking' } }]
    expect(landingBlockFields(rid, 'hotel', blocks)).toEqual([
      { entity_type: 'landing_block', entity_id: rid, field: 'hotel.amenities.items.0', text: 'Bazen' },
      { entity_type: 'landing_block', entity_id: rid, field: 'hotel.amenities.items.1', text: 'Wi-Fi' },
      { entity_type: 'landing_block', entity_id: rid, field: 'hotel.amenities.items.2', text: 'Parking' },
    ])
  })

  it('nepoznat page_type / blok bez data / bez restaurantId → prazno', () => {
    expect(landingBlockFields(rid, 'nepostoji', [{ type: 'hero', data: { title: 'X' } }])).toEqual([])
    expect(landingBlockFields(rid, 'restaurant', [{ type: 'hero' }])).toEqual([])
    expect(landingBlockFields(null, 'restaurant', [{ type: 'hero', data: { title: 'X' } }])).toEqual([])
  })
})

describe('restaurantDescriptionFields', () => {
  const rid = '44444444-4444-4444-4444-444444444444'

  it('gradi stavku za restaurant/description', () => {
    expect(restaurantDescriptionFields(rid, 'Porodični restoran')).toEqual([
      { entity_type: 'restaurant', entity_id: rid, field: 'description', text: 'Porodični restoran' },
    ])
  })

  it('prazno za praznu poruku ili bez id-a', () => {
    expect(restaurantDescriptionFields(rid, '   ')).toEqual([])
    expect(restaurantDescriptionFields(null, 'X')).toEqual([])
  })
})
