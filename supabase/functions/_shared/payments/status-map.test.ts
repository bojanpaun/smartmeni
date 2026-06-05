// ============================================================================
// Sloj 2 — Edge/Deno test: normalizacija statusa plaćanja (status-map.ts)
// ----------------------------------------------------------------------------
// "Princip 2": app sloj nikad ne vidi provajder-specifičan string — sve se
// svodi na NormalizedStatus enum. Najopasnija regresija ovdje je tiha: npr.
// 'declined' → 'paid' (neuspjelo plaćanje tretirano kao plaćeno). Ovi testovi
// zaključavaju tačno te mape.
//
// Pokretanje:  deno test supabase/functions/_shared/payments/status-map.test.ts
// ============================================================================

import { assertEquals } from 'jsr:@std/assert'
import {
  mapStripePaymentIntent,
  mapStripeCheckoutSession,
  mapStripeRefund,
  mapMonriStatus,
  mapPaypalStatus,
} from './status-map.ts'

// Dozvoljeni izlazni statusi (mora se poklapati s NormalizedStatus u types.ts)
const ALLOWED = new Set([
  'pending', 'requires_action', 'authorized', 'paid',
  'failed', 'refunded', 'partially_refunded', 'cancelled',
])

Deno.test('Stripe PaymentIntent — kritične mape', () => {
  assertEquals(mapStripePaymentIntent('succeeded'), 'paid')
  assertEquals(mapStripePaymentIntent('requires_capture'), 'authorized')
  assertEquals(mapStripePaymentIntent('requires_action'), 'requires_action')
  assertEquals(mapStripePaymentIntent('canceled'), 'cancelled')
  assertEquals(mapStripePaymentIntent('processing'), 'pending')
})

Deno.test('Stripe Checkout Session', () => {
  assertEquals(mapStripeCheckoutSession('complete'), 'paid')
  assertEquals(mapStripeCheckoutSession('open'), 'pending')
  assertEquals(mapStripeCheckoutSession('expired'), 'cancelled')
})

Deno.test('Stripe Refund', () => {
  assertEquals(mapStripeRefund('succeeded'), 'refunded')
  assertEquals(mapStripeRefund('failed'), 'failed')
  assertEquals(mapStripeRefund('pending'), 'pending')
})

Deno.test('Monri — uspjeh/neuspjeh i case-insensitivnost', () => {
  assertEquals(mapMonriStatus('approved'), 'paid')
  assertEquals(mapMonriStatus('declined'), 'failed')
  assertEquals(mapMonriStatus('error'), 'failed')
  assertEquals(mapMonriStatus('refunded'), 'refunded')
  assertEquals(mapMonriStatus('voided'), 'cancelled')
  // Monri zna slati velikim slovima — mora i dalje raditi (toLowerCase)
  assertEquals(mapMonriStatus('APPROVED'), 'paid')
  assertEquals(mapMonriStatus('Declined'), 'failed')
})

Deno.test('PayPal — uključujući parcijalni refund', () => {
  assertEquals(mapPaypalStatus('COMPLETED'), 'paid')
  assertEquals(mapPaypalStatus('PARTIALLY_REFUNDED'), 'partially_refunded')
  assertEquals(mapPaypalStatus('REFUNDED'), 'refunded')
  assertEquals(mapPaypalStatus('DENIED'), 'failed')
  assertEquals(mapPaypalStatus('VOIDED'), 'cancelled')
  assertEquals(mapPaypalStatus('APPROVED'), 'authorized')
})

Deno.test('Nepoznat status → siguran fallback "pending" (nikad "paid")', () => {
  assertEquals(mapStripePaymentIntent('nesto_novo'), 'pending')
  assertEquals(mapStripeCheckoutSession(''), 'pending')
  assertEquals(mapMonriStatus('xyz'), 'pending')
  assertEquals(mapPaypalStatus('UNKNOWN'), 'pending')
})

Deno.test('Invarijanta: svaki izlaz je validan NormalizedStatus', () => {
  const inputs = ['succeeded', 'complete', 'approved', 'declined', 'COMPLETED',
    'PARTIALLY_REFUNDED', 'requires_capture', 'voided', 'random_garbage', '']
  for (const s of inputs) {
    for (const fn of [mapStripePaymentIntent, mapStripeCheckoutSession,
      mapStripeRefund, mapMonriStatus, mapPaypalStatus]) {
      const out = fn(s)
      assertEquals(ALLOWED.has(out), true, `"${s}" → "${out}" nije validan enum`)
    }
  }
})
