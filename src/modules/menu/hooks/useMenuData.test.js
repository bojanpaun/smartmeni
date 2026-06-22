import { describe, it, expect } from 'vitest'
import { groupByCategory, cartTotal, discountPercent, compareFromPercent, sortMenuItems, bundleItemsTotal, bundlePriceFromPercent, isBundleLive, isPromoLive, allocateBundleDiscount } from './menuHelpers'

describe('groupByCategory', () => {
  it('grupiše stavke po category_id', () => {
    const items = [
      { id: '1', category_id: 'a' }, { id: '2', category_id: 'b' }, { id: '3', category_id: 'a' },
    ]
    const map = groupByCategory(items)
    expect(map.a.map(i => i.id)).toEqual(['1', '3'])
    expect(map.b.map(i => i.id)).toEqual(['2'])
  })
  it('prazan/undefined ulaz → prazan objekat', () => {
    expect(groupByCategory([])).toEqual({})
    expect(groupByCategory(undefined)).toEqual({})
  })
})

describe('cartTotal', () => {
  it('sabira price·qty', () => {
    expect(cartTotal([{ price: 5, qty: 2 }, { price: 3, qty: 1 }])).toBe(13)
  })
  it('zaokružuje na 2 decimale (bez float repova)', () => {
    expect(cartTotal([{ price: 0.1, qty: 3 }])).toBe(0.3)
    expect(cartTotal([{ price: 2.99, qty: 3 }])).toBe(8.97)
  })
  it('prazna/undefined korpa → 0', () => {
    expect(cartTotal([])).toBe(0)
    expect(cartTotal(undefined)).toBe(0)
  })
})

describe('discountPercent', () => {
  it('računa zaokružen procenat', () => {
    expect(discountPercent(8, 10)).toBe(20)
    expect(discountPercent(7.5, 10)).toBe(25)
    expect(discountPercent(6.67, 10)).toBe(33)
  })
  it('null kad nema validnog popusta', () => {
    expect(discountPercent(10, 10)).toBe(null)   // jednako
    expect(discountPercent(12, 10)).toBe(null)   // skuplje od reference
    expect(discountPercent(10, null)).toBe(null) // bez reference
    expect(discountPercent(0, 10)).toBe(null)    // nevalidna cijena
  })
})

describe('compareFromPercent', () => {
  it('izvodi staru cijenu iz procenta', () => {
    expect(compareFromPercent(8, 20)).toBe(10)
    expect(compareFromPercent(7.5, 25)).toBe(10)
  })
  it('null za nevalidan procenat', () => {
    expect(compareFromPercent(10, 0)).toBe(null)
    expect(compareFromPercent(10, 100)).toBe(null)
    expect(compareFromPercent(0, 20)).toBe(null)
  })
})

describe('sortMenuItems', () => {
  it('sponzorisani prvi, pa po sort_order', () => {
    const items = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1, is_sponsored: true },
      { id: 'c', sort_order: 2 },
      { id: 'd', sort_order: 3, is_sponsored: true },
    ]
    expect(sortMenuItems(items).map(i => i.id)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('ne mijenja original i radi sa praznim ulazom', () => {
    const items = [{ id: 'a', sort_order: 0 }]
    sortMenuItems(items)
    expect(items.map(i => i.id)).toEqual(['a'])
    expect(sortMenuItems(undefined)).toEqual([])
  })
})

describe('bundleItemsTotal', () => {
  it('sabira price × quantity po artiklu', () => {
    const rows = [{ menu_item_id: 'a', quantity: 2 }, { menu_item_id: 'b', quantity: 1 }]
    expect(bundleItemsTotal(rows, { a: 5, b: 3 })).toBe(13)
  })
  it('artikal bez poznate cijene se ignoriše; prazan ulaz → 0', () => {
    expect(bundleItemsTotal([{ menu_item_id: 'x', quantity: 2 }], {})).toBe(0)
    expect(bundleItemsTotal([], {})).toBe(0)
    expect(bundleItemsTotal(undefined, {})).toBe(0)
  })
})

describe('bundlePriceFromPercent', () => {
  it('cijena paketa iz procenta na zbir', () => {
    expect(bundlePriceFromPercent(20, 25)).toBe(15)
    expect(bundlePriceFromPercent(13, 10)).toBe(11.7)
  })
  it('null za nevalidan procenat/zbir', () => {
    expect(bundlePriceFromPercent(0, 20)).toBe(null)
    expect(bundlePriceFromPercent(20, 0)).toBe(null)
    expect(bundlePriceFromPercent(20, 100)).toBe(null)
  })
})

describe('isBundleLive', () => {
  it('aktivan bez perioda → uživo', () => {
    expect(isBundleLive({ is_active: true }, '2026-06-23')).toBe(true)
  })
  it('neaktivan → ne', () => {
    expect(isBundleLive({ is_active: false }, '2026-06-23')).toBe(false)
  })
  it('poštuje valid_from/valid_until', () => {
    expect(isBundleLive({ is_active: true, valid_from: '2026-06-24' }, '2026-06-23')).toBe(false)
    expect(isBundleLive({ is_active: true, valid_until: '2026-06-22' }, '2026-06-23')).toBe(false)
    expect(isBundleLive({ is_active: true, valid_from: '2026-06-01', valid_until: '2026-06-30' }, '2026-06-23')).toBe(true)
  })
  it('null/undefined → ne', () => {
    expect(isBundleLive(null)).toBe(false)
  })
})

describe('allocateBundleDiscount', () => {
  it('jedna PDV grupa: ukupan popust kao jedna stavka', () => {
    // 2×Pica@1000 + 1×Sok@500 = 2500; paket 2000 → popust 500
    const lines = [{ vat_rate_key: 'STANDARD', gross_cents: 2000 }, { vat_rate_key: 'STANDARD', gross_cents: 500 }]
    expect(allocateBundleDiscount(lines, 2000)).toEqual([{ vat_rate_key: 'STANDARD', discount_cents: 500 }])
  })
  it('više PDV grupa: popust raspodijeljen proporcionalno, Σ egzaktno', () => {
    // grupa A 2000 (STANDARD), grupa B 1000 (HOSP); original 3000; paket 2400 → popust 600
    const lines = [{ vat_rate_key: 'STANDARD', gross_cents: 2000 }, { vat_rate_key: 'HOSP', gross_cents: 1000 }]
    const out = allocateBundleDiscount(lines, 2400)
    expect(out.reduce((s, x) => s + x.discount_cents, 0)).toBe(600)
    expect(out.find(x => x.vat_rate_key === 'STANDARD').discount_cents).toBe(400)
    expect(out.find(x => x.vat_rate_key === 'HOSP').discount_cents).toBe(200)
  })
  it('bez popusta (paket ≥ zbir) → prazno', () => {
    expect(allocateBundleDiscount([{ vat_rate_key: 'STANDARD', gross_cents: 2000 }], 2000)).toEqual([])
    expect(allocateBundleDiscount([{ vat_rate_key: 'STANDARD', gross_cents: 2000 }], 2500)).toEqual([])
    expect(allocateBundleDiscount([], 0)).toEqual([])
  })
})

describe('isPromoLive', () => {
  it('generičko: aktivan u periodu → uživo, van perioda → ne', () => {
    expect(isPromoLive({ is_active: true }, '2026-06-23')).toBe(true)
    expect(isPromoLive({ is_active: true, valid_until: '2026-06-22' }, '2026-06-23')).toBe(false)
    expect(isPromoLive({ is_active: false }, '2026-06-23')).toBe(false)
    expect(isPromoLive(null)).toBe(false)
  })
})
