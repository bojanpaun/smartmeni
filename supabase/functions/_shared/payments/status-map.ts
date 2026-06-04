import type { NormalizedStatus } from './types.ts'

// ── Stripe → NormalizedStatus ─────────────────────────────────────
// PaymentIntent statusi
const STRIPE_PI: Record<string, NormalizedStatus> = {
  'requires_payment_method': 'pending',
  'requires_confirmation':   'pending',
  'requires_action':         'requires_action',
  'processing':              'pending',
  'requires_capture':        'authorized',
  'succeeded':               'paid',
  'canceled':                'cancelled',
}
// Checkout Session statusi
const STRIPE_CS: Record<string, NormalizedStatus> = {
  'open':     'pending',
  'complete': 'paid',
  'expired':  'cancelled',
}
// Refund statusi
const STRIPE_REFUND: Record<string, NormalizedStatus> = {
  'succeeded': 'refunded',
  'pending':   'pending',
  'failed':    'failed',
}

// ── Monri → NormalizedStatus ──────────────────────────────────────
const MONRI_TXN: Record<string, NormalizedStatus> = {
  'approved':  'paid',
  'declined':  'failed',
  'error':     'failed',
  'voided':    'cancelled',
  'refunded':  'refunded',
  'expired':   'cancelled',
}

// ── PayPal → NormalizedStatus ─────────────────────────────────────
const PAYPAL_ORDER: Record<string, NormalizedStatus> = {
  'COMPLETED':          'paid',
  'PENDING':            'pending',
  'PARTIALLY_REFUNDED': 'partially_refunded',
  'REFUNDED':           'refunded',
  'VOIDED':             'cancelled',
  'DENIED':             'failed',
  'SAVED':              'pending',
  'APPROVED':           'authorized',
  'CREATED':            'pending',
}

// ── Export helperi ────────────────────────────────────────────────
export function mapStripePaymentIntent(status: string): NormalizedStatus {
  return STRIPE_PI[status] ?? 'pending'
}

export function mapStripeCheckoutSession(status: string): NormalizedStatus {
  return STRIPE_CS[status] ?? 'pending'
}

export function mapStripeRefund(status: string): NormalizedStatus {
  return STRIPE_REFUND[status] ?? 'pending'
}

export function mapMonriStatus(status: string): NormalizedStatus {
  return MONRI_TXN[status?.toLowerCase()] ?? 'pending'
}

export function mapPaypalStatus(status: string): NormalizedStatus {
  return PAYPAL_ORDER[status] ?? 'pending'
}
