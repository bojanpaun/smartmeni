// PAY-6 — Stripe provajder
// Koristi Stripe Checkout Session (hosted redirect) za paritet sa Monri modelom
import type {
  PaymentProvider, SessionCtx, NormalizedEvent,
  NormalizedStatus, RefundResult,
} from './types.ts'
import { mapStripeCheckoutSession, mapStripePaymentIntent } from './status-map.ts'

const STRIPE_API = 'https://api.stripe.com/v1'

export class StripeProvider implements PaymentProvider {
  readonly id = 'stripe' as const
  private readonly secretKey: string
  private readonly webhookSecret: string

  constructor(credentials: Record<string, string>, _mode: 'test' | 'live') {
    this.secretKey     = credentials.secret_key     ?? ''
    this.webhookSecret = credentials.webhook_secret ?? ''
  }

  // ── HTTP helper ─────────────────────────────────────────────────
  private async req(method: string, path: string, params?: Record<string, unknown>) {
    const res = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: {
        'Authorization':  `Bearer ${this.secretKey}`,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16',
      },
      body: params ? new URLSearchParams(flattenParams(params)).toString() : undefined,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(`Stripe ${method} ${path}: ${data.error?.message ?? res.statusText}`)
    }
    return data
  }

  // ── Checkout Session (hosted redirect) ──────────────────────────
  async createCheckoutSession(ctx: SessionCtx) {
    const sep = ctx.successUrl.includes('?') ? '&' : '?'
    const session = await this.req('POST', '/checkout/sessions', {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency:     ctx.currency.toLowerCase(),
          unit_amount:  ctx.amountMinor,
          product_data: { name: ctx.description ?? 'Booking' },
        },
        quantity: 1,
      }],
      success_url: `${ctx.successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:   ctx.cancelUrl,
      metadata: {
        restaurant_id:   ctx.restaurantId,
        source_type:     ctx.sourceType,
        source_id:       ctx.sourceId,
        idempotency_key: ctx.idempotencyKey,
        ...ctx.metadata,
      },
    })

    return {
      redirectUrl: session.url as string,
      providerRef: session.id  as string,
    }
  }

  // ── Webhook verifikacija + parsiranje ────────────────────────────
  async verifyAndParseWebhook(rawBody: string, headers: Headers): Promise<NormalizedEvent> {
    const sig = headers.get('stripe-signature')
    if (!sig) throw new Error('Nedostaje Stripe-Signature header')
    await verifyStripeSignature(rawBody, sig, this.webhookSecret)

    const event = JSON.parse(rawBody)
    const obj   = event.data?.object ?? {}

    let providerRef: string = obj.id ?? ''
    let status: NormalizedStatus = 'pending'
    let amountMinor: number | undefined

    switch (event.type) {
      case 'checkout.session.completed':
        status      = 'paid'
        amountMinor = obj.amount_total
        break
      case 'checkout.session.expired':
        status = 'cancelled'
        break
      case 'payment_intent.succeeded':
        status      = 'paid'
        amountMinor = obj.amount_received
        break
      case 'payment_intent.payment_failed':
        status = 'failed'
        break
      case 'charge.refunded':
        providerRef = obj.payment_intent ?? obj.id
        status      = obj.refunded ? 'refunded' : 'partially_refunded'
        amountMinor = obj.amount_refunded
        break
    }

    return {
      providerRef,
      status,
      amountMinor,
      currency:   (obj.currency as string | undefined)?.toUpperCase(),
      rawPayload: event,
    }
  }

  // ── Status lookup ────────────────────────────────────────────────
  async getStatus(providerRef: string): Promise<NormalizedStatus> {
    if (providerRef.startsWith('cs_')) {
      const s = await this.req('GET', `/checkout/sessions/${providerRef}`)
      return mapStripeCheckoutSession(s.status)
    }
    const pi = await this.req('GET', `/payment_intents/${providerRef}`)
    return mapStripePaymentIntent(pi.status)
  }

  // ── Refund ───────────────────────────────────────────────────────
  async refund(providerRef: string, amountMinor?: number): Promise<RefundResult> {
    // Ako je Checkout Session ID, dohvati PaymentIntent
    let piId = providerRef
    if (providerRef.startsWith('cs_')) {
      const s = await this.req('GET', `/checkout/sessions/${providerRef}`)
      piId    = s.payment_intent
    }
    const params: Record<string, unknown> = { payment_intent: piId }
    if (amountMinor) params.amount = amountMinor

    const refund = await this.req('POST', '/refunds', params)
    return {
      success:     refund.status === 'succeeded',
      providerRef: refund.id,
      amountMinor: refund.amount,
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

// Flatten nested objects u Stripe URL-encoded format
// npr. line_items[0][price_data][currency]=eur
function flattenParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(out, flattenParams(item as Record<string, unknown>, `${key}[${i}]`))
        } else {
          out[`${key}[${i}]`] = String(item)
        }
      })
    } else if (typeof v === 'object') {
      Object.assign(out, flattenParams(v as Record<string, unknown>, key))
    } else {
      out[key] = String(v)
    }
  }
  return out
}

// HMAC-SHA256 verifikacija Stripe webhook potpisa (Web Crypto API, bez dependencija)
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string) {
  const parts: Record<string, string> = {}
  sigHeader.split(',').forEach(part => {
    const idx = part.indexOf('=')
    parts[part.slice(0, idx)] = part.slice(idx + 1)
  })

  const { t: timestamp, v1: signature } = parts
  if (!timestamp || !signature) throw new Error('Neispravan Stripe-Signature format')

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
    throw new Error('Stripe webhook timestamp je prestar (>5 min)')
  }

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const mac      = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`))
  const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')

  if (computed !== signature) throw new Error('Stripe webhook potpis nije ispravan')
}
