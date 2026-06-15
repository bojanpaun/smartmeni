import { describe, it, expect } from 'vitest'
import { groupByCategory, cartTotal } from './menuHelpers'

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
