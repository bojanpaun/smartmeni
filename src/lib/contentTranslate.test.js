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

const { orderRejectionFields, menuItemFields } = await import('./contentTranslate.js')

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
