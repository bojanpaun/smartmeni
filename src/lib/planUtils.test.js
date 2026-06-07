// ============================================================================
// Sloj 3 — Unit testovi: planUtils (čiste funkcije za plan/addon logiku)
// ----------------------------------------------------------------------------
// hasAddon je jedini izvor istine za pristup plaćenim feature-ima. Regresija
// ovdje = ili curenje prihoda (besplatan pristup) ili slomljen feature.
//
// Pokretanje:  npm run test:unit      (vidi package.json skripte u README/chatu)
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  hasAddon, planStatus, isPro, isSuspended, trialDaysLeft, PLAN_PRICING,
} from './planUtils.js'

describe('hasAddon', () => {
  it('vraća false kad nema pretplate', () => {
    expect(hasAddon(null, 'hotel_core')).toBe(false)
    expect(hasAddon(undefined, 'hotel_core')).toBe(false)
  })

  it('enterprise plan ima sve addonе', () => {
    const sub = { plan: 'enterprise' }
    expect(hasAddon(sub, 'hotel_core')).toBe(true)
    expect(hasAddon(sub, 'bilo_sta')).toBe(true)
  })

  it('hotel plan uključuje hotelske addonе, ali NE spa_wellness', () => {
    const sub = { plan: 'hotel' }
    expect(hasAddon(sub, 'hotel_core')).toBe(true)
    expect(hasAddon(sub, 'housekeeping')).toBe(true)
    expect(hasAddon(sub, 'hr_pro')).toBe(true)        // dijeljeni operativni addon
    expect(hasAddon(sub, 'spa_wellness')).toBe(false) // samo u hotel_pro
  })

  it('hotel_pro uključuje spa_wellness', () => {
    expect(hasAddon({ plan: 'hotel_pro' }, 'spa_wellness')).toBe(true)
  })

  it('restaurant plan nema hotel_core, ali ima hr_pro', () => {
    const sub = { plan: 'restaurant' }
    expect(hasAddon(sub, 'hotel_core')).toBe(false)
    expect(hasAddon(sub, 'hr_pro')).toBe(true)
  })

  it('individualni (grandfathered/trial) addon važi i van plana', () => {
    const sub = { plan: 'restaurant', addons: ['spa_wellness'] }
    expect(hasAddon(sub, 'spa_wellness')).toBe(true)
  })

  it("stari naziv 'pro' se normalizuje na 'restaurant'", () => {
    const sub = { plan: 'pro' }
    expect(hasAddon(sub, 'hr_pro')).toBe(true)
    expect(hasAddon(sub, 'hotel_core')).toBe(false)
  })

  describe('planIncludesOverride (DB-driven includes)', () => {
    it('DB override određuje uključenja umjesto konstante', () => {
      const sub = { plan: 'bistro' } // superadmin-kreiran plan
      const override = { bistro: ['hr_pro', 'inventory_pro'] }
      expect(hasAddon(sub, 'hr_pro', override)).toBe(true)
      expect(hasAddon(sub, 'hotel_core', override)).toBe(false)
    })

    it('override sa null = sve uključeno (custom enterprise-like)', () => {
      const sub = { plan: 'mega' }
      expect(hasAddon(sub, 'bilo_sta', { mega: null })).toBe(true)
    })

    it('plan koji nije u override mapi pada na konstantu', () => {
      const sub = { plan: 'hotel' }
      const override = { bistro: ['hr_pro'] } // hotel nije tu
      expect(hasAddon(sub, 'hotel_core', override)).toBe(true) // iz PLAN_INCLUDES
    })

    it('bez override-a ponašanje ostaje nepromijenjeno', () => {
      expect(hasAddon({ plan: 'hotel' }, 'spa_wellness')).toBe(false)
    })
  })
})

describe('isPro / isSuspended', () => {
  it('isPro: starter nije pro, hotel jest, complimentary uvijek jest', () => {
    expect(isPro(null)).toBe(false)
    expect(isPro({ plan: 'starter' })).toBe(false)
    expect(isPro({ plan: 'hotel' })).toBe(true)
    expect(isPro({ is_complimentary: true })).toBe(true)
  })

  it('isSuspended: suspended_at suspenduje, ali complimentary nikad', () => {
    expect(isSuspended({ suspended_at: '2026-01-01' })).toBe(true)
    expect(isSuspended({ suspended_at: '2026-01-01', is_complimentary: true })).toBe(false)
    expect(isSuspended({})).toBe(false)
  })
})

describe('planStatus (prioritet stanja)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('complimentary pobjeđuje sve', () => {
    expect(planStatus({ is_complimentary: true, suspended_at: '2026-01-01', plan: 'hotel' }))
      .toBe('complimentary')
  })

  it('suspended pobjeđuje plan', () => {
    expect(planStatus({ suspended_at: '2026-01-01', plan: 'hotel' })).toBe('suspended')
  })

  it('aktivan plan vraća naziv plana', () => {
    expect(planStatus({ plan: 'hotel' })).toBe('hotel')
  })

  it('starter sa trial u budućnosti = trial', () => {
    expect(planStatus({ plan: 'starter', trial_ends_at: '2026-06-15T12:00:00Z' })).toBe('trial')
  })

  it('starter sa isteklim trial = expired', () => {
    expect(planStatus({ plan: 'starter', trial_ends_at: '2026-06-01T12:00:00Z' })).toBe('expired')
  })

  it('bez plana i bez triala = starter', () => {
    expect(planStatus({})).toBe('starter')
    expect(planStatus(null)).toBe('starter')
  })
})

describe('trialDaysLeft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('računa preostale dane', () => {
    expect(trialDaysLeft({ trial_ends_at: '2026-06-15T12:00:00Z' })).toBe(10)
  })
  it('istekao trial = 0 (ne negativno)', () => {
    expect(trialDaysLeft({ trial_ends_at: '2026-06-04T12:00:00Z' })).toBe(0)
  })
  it('nema triala = null', () => {
    expect(trialDaysLeft({})).toBe(null)
    expect(trialDaysLeft({ is_complimentary: true })).toBe(null)
  })
})

describe('PLAN_PRICING (sanity)', () => {
  it('godišnja cijena je 12× mjesečna po mjesecu', () => {
    for (const p of Object.values(PLAN_PRICING)) {
      expect(p.annual_total).toBe(p.annual_per_month * 12)
    }
  })
})
