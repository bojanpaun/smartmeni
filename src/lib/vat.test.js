// ============================================================================
// FISK-1 — Unit testovi: PDV motor (vat.js). Pogrešan obračun = pogrešan
// fiskalni/poreski iznos, pa je invarijanta base+vat==gross kritična.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { resolveRate, vatBreakdownFromGross, computeInvoiceTax } from './vat.js'

const ME_RATES = [
  { key: 'STANDARD', value: 0.21, label: 'Standardna (21%)' },
  { key: 'HOSP', value: 0.15, label: 'Ugostiteljstvo (15%)' },
  { key: 'BASIC', value: 0.07, label: 'Snižena (7%)' },
]

describe('resolveRate', () => {
  it('vraća decimalnu stopu po ključu', () => {
    expect(resolveRate(ME_RATES, 'STANDARD')).toBe(0.21)
    expect(resolveRate(ME_RATES, 'HOSP')).toBe(0.15)
  })
  it('nepoznat ključ / prazno → 0', () => {
    expect(resolveRate(ME_RATES, 'NEMA')).toBe(0)
    expect(resolveRate(undefined, 'STANDARD')).toBe(0)
  })
})

describe('vatBreakdownFromGross', () => {
  it('izvlači osnovicu i PDV iz bruto (21%)', () => {
    // €121.00 bruto @ 21% → osnovica €100.00, PDV €21.00
    expect(vatBreakdownFromGross(12100, 0.21)).toEqual({ grossMinor: 12100, baseMinor: 10000, vatMinor: 2100 })
  })
  it('zaokružuje osnovicu, PDV = razlika (base+vat==gross)', () => {
    // €1.00 @ 21% → base round(100/1.21)=round(82.64)=83, vat=17
    const r = vatBreakdownFromGross(100, 0.21)
    expect(r).toEqual({ grossMinor: 100, baseMinor: 83, vatMinor: 17 })
    expect(r.baseMinor + r.vatMinor).toBe(r.grossMinor)
  })
  it('stopa 0 → osnovica = bruto, PDV = 0', () => {
    expect(vatBreakdownFromGross(5000, 0)).toEqual({ grossMinor: 5000, baseMinor: 5000, vatMinor: 0 })
  })
  it('zaokružuje necjelobrojni minor ulaz', () => {
    expect(vatBreakdownFromGross(100.4, 0).grossMinor).toBe(100)
  })
})

describe('computeInvoiceTax', () => {
  it('agregira stavke iste stope u jednu grupu', () => {
    const out = computeInvoiceTax(
      [{ amountMinor: 6050, vatRateKey: 'HOSP' }, { amountMinor: 6050, vatRateKey: 'HOSP' }],
      ME_RATES,
    )
    expect(out.groups).toHaveLength(1)
    expect(out.groups[0]).toMatchObject({ vatRateKey: 'HOSP', rate: 0.15, grossMinor: 12100 })
    expect(out.totalGrossMinor).toBe(12100)
  })

  it('razdvaja po stopi i čuva invarijantu base+vat==gross po grupi i ukupno', () => {
    const out = computeInvoiceTax(
      [
        { amountMinor: 12100, vatRateKey: 'STANDARD' }, // 21%
        { amountMinor: 11500, vatRateKey: 'HOSP' },     // 15%
        { amountMinor: 10700, vatRateKey: 'BASIC' },    // 7%
      ],
      ME_RATES,
    )
    expect(out.groups).toHaveLength(3)
    for (const g of out.groups) expect(g.baseMinor + g.vatMinor).toBe(g.grossMinor)
    expect(out.totalBaseMinor + out.totalVatMinor).toBe(out.totalGrossMinor)
    expect(out.totalGrossMinor).toBe(12100 + 11500 + 10700)
    // grupe sortirane po ključu (BASIC, HOSP, STANDARD)
    expect(out.groups.map((g) => g.vatRateKey)).toEqual(['BASIC', 'HOSP', 'STANDARD'])
  })

  it('preskače stavke bez vat_rate_key i prazan ulaz', () => {
    const out = computeInvoiceTax([{ amountMinor: 100 }, null, { amountMinor: 500, vatRateKey: 'BASIC' }], ME_RATES)
    expect(out.groups).toHaveLength(1)
    expect(out.totalGrossMinor).toBe(500)
    expect(computeInvoiceTax([], ME_RATES)).toMatchObject({ totalGrossMinor: 0, totalBaseMinor: 0, totalVatMinor: 0 })
  })
})
