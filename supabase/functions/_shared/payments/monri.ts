// PAY-8 — Monri/Payten provajder
// Model: RedirectForm — server potpisuje zahtjev (SHA-512 digest), gost plati na Monri stranici
//
// ⚠ NAPOMENA: Tačna polja i algoritam digesta provjeriti sa aktuelnom Monri/Payten
// integracijom (razlikuje se po banci i verifikaciji). Ova implementacija bazirana
// je na standardnoj Monri WebPay dokumentaciji (2024/2025).

import type {
  PaymentProvider, SessionCtx, NormalizedEvent,
  NormalizedStatus, RefundResult,
} from './types.ts'
import { mapMonriStatus } from './status-map.ts'

// Monri gateway URL-ovi
const MONRI_GATEWAY = {
  live: 'https://ipg.monri.com/v2/form',
  test: 'https://ipgtest.monri.com/v2/form',
}

// Monri Transactions API (za status provjeru i refund)
const MONRI_API = {
  live: 'https://ipg.monri.com/transactions',
  test: 'https://ipgtest.monri.com/transactions',
}

export class MonriProvider implements PaymentProvider {
  readonly id = 'monri' as const
  private readonly merchantKey: string
  private readonly authenticityToken: string
  private readonly mode: 'test' | 'live'
  private readonly supabaseUrl: string

  constructor(
    credentials: Record<string, string>,
    mode: 'test' | 'live',
    _publicConfig: Record<string, unknown>,
  ) {
    this.merchantKey       = credentials.merchant_key        ?? ''
    this.authenticityToken = credentials.authenticity_token  ?? ''
    this.mode              = mode
    this.supabaseUrl       = Deno.env.get('SUPABASE_URL') ?? ''
  }

  // ── Checkout Session ────────────────────────────────────────────
  // Vraća redirectUrl = Monri gateway URL sa potpisanim parametrima
  // Ako Monri banka zahtijeva POST umjesto GET — frontend može koristiti
  // params iz URL query string-a za auto-submit formu (vidi PAY-10)
  async createCheckoutSession(ctx: SessionCtx) {
    if (!this.merchantKey || !this.authenticityToken) {
      throw new Error('Monri kredencijali nisu postavljeni (merchant_key, authenticity_token)')
    }

    // order_number: Monri max 40 znakova, alphanumeric
    const orderNumber = ctx.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
    const amount      = ctx.amountMinor.toString()     // u centima, bez decimala
    const currency    = ctx.currency.toUpperCase()      // 'EUR'
    const txType      = 'purchase'

    // Digest = SHA-512(merchant_key + order_number + amount + currency + transaction_type + authenticity_token)
    const digest = await sha512(`${this.merchantKey}${orderNumber}${amount}${currency}${txType}${this.authenticityToken}`)

    // Callback URL — Monri šalje POST na ovaj endpoint po završetku transakcije
    const callbackUrl = `${this.supabaseUrl}/functions/v1/payments-webhook?provider=monri`

    const params = new URLSearchParams({
      'merchant_key':       this.merchantKey,
      'authenticity_token': this.authenticityToken,
      'order_number':       orderNumber,
      'amount':             amount,
      'currency':           currency,
      'transaction_type':   txType,
      'digest':             digest,
      'success_url_override': ctx.successUrl,
      'cancel_url_override':  ctx.cancelUrl,
      'callback_url':         callbackUrl,
      'order_info':           (ctx.description ?? 'Booking').slice(0, 100),
      // Metadata za webhook → ažuriranje payment_transactions + source
      'custom_attribute_1':   ctx.restaurantId,
      'custom_attribute_2':   ctx.sourceType,
      'custom_attribute_3':   ctx.sourceId,
      'custom_attribute_4':   ctx.idempotencyKey,
      // Opcional: podaci gosta (preporučeno za 3DS)
      ...(ctx.metadata?.guest_name  ? { 'ch_full_name': ctx.metadata.guest_name }  : {}),
      ...(ctx.metadata?.guest_email ? { 'ch_email':     ctx.metadata.guest_email } : {}),
    })

    const gatewayUrl = MONRI_GATEWAY[this.mode]
    const redirectUrl = `${gatewayUrl}?${params.toString()}`

    return {
      redirectUrl,
      providerRef: orderNumber, // Monri referenca je order_number
    }
  }

  // ── Webhook verifikacija + parsiranje ────────────────────────────
  // Monri šalje POST callback (x-www-form-urlencoded) po završetku transakcije
  async verifyAndParseWebhook(rawBody: string, _headers: Headers): Promise<NormalizedEvent> {
    // Parsiraj callback — Monri šalje form-encoded podatke
    let params: URLSearchParams
    try {
      params = new URLSearchParams(rawBody)
    } catch {
      throw new Error('Monri callback nije valid form-encoded')
    }

    // Verifikuj digest callbacka
    await this.verifyCallbackDigest(params)

    const orderNumber   = params.get('order_number')   ?? params.get('custom_attribute_4') ?? ''
    const responseCode  = params.get('response_code')  ?? ''
    const approvalCode  = params.get('approval_code')  ?? ''
    const monriStatus   = params.get('status')         ?? ''
    const amount        = parseInt(params.get('amount') ?? '0', 10)
    const currency      = (params.get('currency') ?? 'EUR').toUpperCase()

    // Monri status: 'approved' / response_code '0000' = plaćeno
    const isPaid = responseCode === '0000' || approvalCode !== '' || monriStatus === 'approved'
    const normalizedStatus: NormalizedStatus = isPaid ? 'paid' : mapMonriStatus(monriStatus || responseCode)

    // restaurant_id i sourceType/sourceId iz custom_attribute polja
    const restaurantId = params.get('custom_attribute_1') ?? ''
    const sourceType   = params.get('custom_attribute_2') ?? 'booking'
    const sourceId     = params.get('custom_attribute_3') ?? ''

    return {
      providerRef: orderNumber,
      status:      normalizedStatus,
      amountMinor: amount,
      currency,
      rawPayload:  Object.fromEntries(params),
    }
  }

  // ── Verifikacija callback digesta ────────────────────────────────
  // SHA-512(authenticity_token + response_code + order_number + amount + currency)
  // ⚠ Provjeri sa Monri dokumentacijom — redoslijed polja može varirati
  private async verifyCallbackDigest(params: URLSearchParams) {
    const digest = params.get('digest')
    if (!digest) {
      throw new Error('Nedostaje digest u Monri callbacku')
    }

    const responseCode = params.get('response_code') ?? ''
    const orderNumber  = params.get('order_number')  ?? ''
    const amount       = params.get('amount')        ?? ''
    const currency     = (params.get('currency') ?? 'EUR').toUpperCase()

    const digestInput = `${this.authenticityToken}${responseCode}${orderNumber}${amount}${currency}`
    const computed    = await sha512(digestInput)

    if (computed.toLowerCase() !== digest.toLowerCase()) {
      throw new Error('Monri callback digest nije ispravan — mogući pokušaj prevare')
    }
  }

  // ── Status provjera ──────────────────────────────────────────────
  // Monri Transactions API (zahtijeva API ključ — opcionalno)
  async getStatus(providerRef: string): Promise<NormalizedStatus> {
    // Monri nema standardni status endpoint koji je uvijek dostupan
    // Status se primarno dobiva kroz callback — ovo je fallback
    console.warn('[Monri] getStatus nije implementiran za:', providerRef)
    return 'pending'
  }

  // ── Refund ───────────────────────────────────────────────────────
  // Monri refund zahtijeva specifičan API pristup i merchant autorizaciju
  // Implementirati kad Monri merchant nalog bude dostupan za testiranje
  async refund(providerRef: string, _amountMinor?: number): Promise<RefundResult> {
    // TODO PAY-12: implementirati Monri refund API
    // POST ${MONRI_API[mode]}/refund sa potpisanim zahtjevom
    throw new Error(`Monri refund za ${providerRef} nije implementiran — obratite se Monri podršci`)
  }
}

// ── SHA-512 helper (Web Crypto API) ──────────────────────────────
async function sha512(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
