// ============================================================================
// FISK-0 — Unit testovi: currencies (formatMoney + minor-unit granica).
// Minor-unit konverzija mora biti tačna (payments amountMinor i fiskalni total
// zavise od nje — greška = pogrešno naplaćen/fiskalizovan iznos).
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  formatMoney, toMinorUnits, fromMinorUnits, currencyMeta,
  isSupportedCurrency, CURRENCY_CODES, DEFAULT_CURRENCY,
} from './currencies.js'

describe('toMinorUnits', () => {
  it('konvertuje 2-decimalni iznos u centi', () => {
    expect(toMinorUnits(12.34, 'EUR')).toBe(1234)
    expect(toMinorUnits(0, 'EUR')).toBe(0)
    expect(toMinorUnits(1000, 'EUR')).toBe(100000)
  })

  it('zaokružuje float artefakte (ne odsijeca)', () => {
    expect(toMinorUnits(12.345, 'EUR')).toBe(1235)
    expect(toMinorUnits(0.1 + 0.2, 'EUR')).toBe(30) // 0.30000000000000004
  })

  it('podrazumijeva default valutu i tretira nevalidan ulaz kao 0', () => {
    expect(toMinorUnits(5)).toBe(500)
    expect(toMinorUnits(undefined, 'EUR')).toBe(0)
    expect(toMinorUnits(null, 'EUR')).toBe(0)
  })
})

describe('fromMinorUnits', () => {
  it('vraća decimalni iznos iz centi (round-trip)', () => {
    expect(fromMinorUnits(1234, 'EUR')).toBe(12.34)
    expect(fromMinorUnits(toMinorUnits(99.99, 'EUR'), 'EUR')).toBe(99.99)
  })
})

describe('currencyMeta', () => {
  it('vraća registrovanu valutu', () => {
    expect(currencyMeta('EUR')).toMatchObject({ code: 'EUR', decimals: 2, symbolPosition: 'before' })
    expect(currencyMeta('RSD').symbolPosition).toBe('after')
  })

  it('nepoznata valuta → razuman default (2 decimale)', () => {
    expect(currencyMeta('XYZ').decimals).toBe(2)
    expect(currencyMeta(undefined).code).toBe(DEFAULT_CURRENCY)
  })
})

describe('isSupportedCurrency', () => {
  it('prepoznaje registrovane kodove', () => {
    expect(isSupportedCurrency('EUR')).toBe(true)
    expect(isSupportedCurrency('TRY')).toBe(true)
    expect(isSupportedCurrency('XXX')).toBe(false)
  })

  it('svi registrovani su 2-decimalni (regionalni targeti)', () => {
    for (const code of CURRENCY_CODES) expect(currencyMeta(code).decimals).toBe(2)
  })
})

describe('formatMoney', () => {
  it('vraća string sa iznosom i radi za sve valute', () => {
    for (const code of CURRENCY_CODES) {
      const out = formatMoney(12.34, code, 'me')
      expect(typeof out).toBe('string')
      expect(out).toMatch(/12/)
    }
  })

  it('koristi 2 decimale', () => {
    expect(formatMoney(5, 'EUR', 'en')).toMatch(/5[.,]00/)
  })

  it('ne pada na nevalidan iznos (→ 0)', () => {
    const out = formatMoney(undefined, 'EUR', 'me')
    expect(typeof out).toBe('string')
    expect(out).toMatch(/0/)
  })

  it('default valuta kad nije zadata', () => {
    expect(typeof formatMoney(10)).toBe('string')
  })
})
