// PAY-8 — Monri/Payten provajder (WebPay v2 Form, redirect model)
// Usklađeno sa zvaničnom Monri v2 form dokumentacijom:
//   https://ipgtest.monri.com/en/documentation/v2_form
//   https://docs.monri.com/docs/how-to-calculate-digest
//
// Model: server potpiše zahtjev (digest) i frontend POST-uje formu na Monri
// gateway (POST, NE GET). Monri vrati gosta na success/cancel URL i pošalje
// server callback na callback_url_override → payments-webhook?provider=monri.
//
// Kredencijali (payment_credentials.credentials):
//   - merchant_key       = Monri "Key" (tajni ključ, ULAZI u digest, NE šalje se)
//   - authenticity_token = identifikator trgovca (ŠALJE se kao polje, NIJE u digestu)

import type {
  PaymentProvider, SessionCtx, NormalizedEvent,
  NormalizedStatus, RefundResult,
} from './types.ts'
import { mapMonriStatus } from './status-map.ts'

const MONRI_FORM = {
  live: 'https://ipg.monri.com/v2/form',
  test: 'https://ipgtest.monri.com/v2/form',
}
const MONRI_TX = {
  live: 'https://ipg.monri.com/v2/transaction',
  test: 'https://ipgtest.monri.com/v2/transaction',
}

export class MonriProvider implements PaymentProvider {
  readonly id = 'monri' as const
  private readonly key: string                // Monri "Key" (tajni, za digest)
  private readonly authenticityToken: string  // identifikator trgovca
  private readonly mode: 'test' | 'live'
  private readonly supabaseUrl: string

  constructor(
    credentials: Record<string, string>,
    mode: 'test' | 'live',
    _publicConfig: Record<string, unknown>,
  ) {
    this.key               = credentials.merchant_key       ?? ''
    this.authenticityToken = credentials.authenticity_token ?? ''
    this.mode              = mode
    this.supabaseUrl       = Deno.env.get('SUPABASE_URL') ?? ''
  }

  // ── Checkout Session ────────────────────────────────────────────
  // Vraća formPost (action + fields) — frontend POST-uje na Monri gateway.
  async createCheckoutSession(ctx: SessionCtx) {
    if (!this.key || !this.authenticityToken) {
      throw new Error('Monri kredencijali nisu postavljeni (merchant_key=Key, authenticity_token)')
    }

    // order_number: max 40, alphanumeric. Koristimo idempotencyKey (jedinstven).
    const orderNumber = ctx.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)
    const amount      = String(ctx.amountMinor)        // minor units (centi), bez decimala
    const currency    = ctx.currency.toUpperCase()     // 'EUR'

    // Zvanično: digest = SHA512(key + order_number + amount + currency)
    const digest = await sha512(`${this.key}${orderNumber}${amount}${currency}`)

    const callbackUrl = `${this.supabaseUrl}/functions/v1/payments-webhook?provider=monri`

    // POST polja po v2 form spec. Routing (restaurant_id/source) NE oslanjamo na
    // custom_attributes (format varira) — webhook ga razrješava preko order_number
    // iz payment_transactions.
    const fields: Record<string, string> = {
      authenticity_token:   this.authenticityToken,
      digest,
      order_number:         orderNumber,
      amount,
      currency,
      transaction_type:     'purchase',
      language:             'en',
      order_info:           (ctx.description ?? 'Booking').slice(0, 100),
      success_url_override: ctx.successUrl,
      cancel_url_override:  ctx.cancelUrl,
      callback_url_override: callbackUrl,
      ...(ctx.metadata?.guest_name  ? { ch_full_name: ctx.metadata.guest_name.slice(0, 30) } : {}),
      ...(ctx.metadata?.guest_email ? { ch_email:     ctx.metadata.guest_email.slice(0, 100) } : {}),
    }

    return {
      providerRef: orderNumber,
      formPost: { action: MONRI_FORM[this.mode], fields },
    }
  }

  // ── Webhook (server callback) verifikacija + parsiranje ──────────
  // Monri POST-uje callback na callback_url_override. Format može biti
  // form-encoded ili JSON — parsiramo defanzivno.
  //
  // ⚠ POTVRDITI SA TEST NALOGOM: tačan format callback payload-a i digest
  // polja. Zvanični response digest (browser redirect) = SHA512(key + url_bez_digest);
  // za server callback potvrditi tačan skup polja prije LIVE-a.
  async verifyAndParseWebhook(rawBody: string, _headers: Headers): Promise<NormalizedEvent> {
    const params = parseBody(rawBody)

    await this.verifyCallbackDigest(params)

    const orderNumber  = params.order_number ?? ''
    const responseCode = params.response_code ?? ''
    const approvalCode = params.approval_code ?? ''
    const monriStatus  = params.status ?? ''
    const amount       = parseInt(params.amount ?? '0', 10)
    const currency     = (params.currency ?? 'EUR').toUpperCase()

    // response_code '0000' = odobreno (Monri standard)
    const isPaid = responseCode === '0000' || approvalCode !== '' || monriStatus === 'approved'
    const status: NormalizedStatus = isPaid ? 'paid' : mapMonriStatus(monriStatus || responseCode)

    return { providerRef: orderNumber, status, amountMinor: amount, currency, rawPayload: params }
  }

  // ⚠ NEPOTVRĐENO za server callback — finalno uskladiti sa test nalogom.
  // Pokušaj po dokumentovanom obrascu (key prvi). Ako callback nema digest, ne
  // odbijamo (Monri neke notifikacije šalje bez digesta) ali logujemo.
  private async verifyCallbackDigest(params: Record<string, string>) {
    const digest = params.digest
    if (!digest) {
      console.warn('[Monri] callback bez digest polja — preskačem verifikaciju (POTVRDITI sa test nalogom)')
      return
    }
    const orderNumber  = params.order_number  ?? ''
    const amount       = params.amount        ?? ''
    const currency     = (params.currency ?? 'EUR').toUpperCase()
    const responseCode = params.response_code ?? ''

    // Pokušaj: SHA512(key + response_code + order_number + amount + currency)
    const computed = await sha512(`${this.key}${responseCode}${orderNumber}${amount}${currency}`)
    if (computed.toLowerCase() !== digest.toLowerCase()) {
      throw new Error('Monri callback digest nije ispravan — mogući pokušaj prevare ili pogrešna formula (potvrditi sa test nalogom)')
    }
  }

  // ── Status (Monri primarno preko callbacka) ──────────────────────
  async getStatus(providerRef: string): Promise<NormalizedStatus> {
    console.warn('[Monri] getStatus nije implementiran (status stiže callbackom):', providerRef)
    return 'pending'
  }

  // ── Refund — Transaction API ─────────────────────────────────────
  // POST /v2/transaction, transaction_type=refund, digest=SHA512(key+order+amount+currency)
  async refund(providerRef: string, amountMinor?: number): Promise<RefundResult> {
    if (!this.key || !this.authenticityToken) {
      throw new Error('Monri kredencijali nisu postavljeni za refund')
    }
    if (amountMinor == null) {
      throw new Error('Monri refund zahtijeva iznos (amountMinor)')
    }
    const amount   = String(amountMinor)
    const currency = 'EUR'
    const digest   = await sha512(`${this.key}${providerRef}${amount}${currency}`)

    const res = await fetch(MONRI_TX[this.mode], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_type:   'refund',
        order_number:       providerRef,
        amount,
        currency,
        authenticity_token: this.authenticityToken,
        digest,
        language:           'en',
      }),
    })
    const data = await res.json().catch(() => ({}))
    const ok = res.ok && (data?.status === 'approved' || data?.response_code === '0000')
    if (!ok) {
      throw new Error(`Monri refund nije uspio: ${data?.response_code ?? res.status} ${data?.message ?? ''}`)
    }
    return { success: true, providerRef, amountMinor }
  }
}

// ── Helpers ──────────────────────────────────────────────────────
// Parsiraj callback body: probaj JSON, pa form-encoded.
function parseBody(raw: string): Record<string, string> {
  try {
    const j = JSON.parse(raw)
    if (j && typeof j === 'object') {
      const flat: Record<string, string> = {}
      for (const [k, v] of Object.entries(j)) flat[k] = String(v)
      return flat
    }
  } catch { /* nije JSON → form-encoded */ }
  return Object.fromEntries(new URLSearchParams(raw))
}

async function sha512(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
