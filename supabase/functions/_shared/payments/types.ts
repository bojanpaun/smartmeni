// ── Normalizovan status enum ──────────────────────────────────────
// Jedini dozvoljeni statusi u app sloju — nikad provajder-specifičan string
export type NormalizedStatus =
  | 'pending'
  | 'requires_action'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'

export type ProviderType = 'stripe' | 'monri' | 'paypal'
export type SourceType   = 'booking' | 'folio' | 'order' | 'spa'

// Kontekst za kreiranje checkout sesije
export interface SessionCtx {
  restaurantId:   string
  sourceType:     SourceType
  sourceId:       string        // reservation_id, folio_id, ...
  amountMinor:    number        // iznos u centima (EUR cents)
  currency:       string        // 'EUR'
  idempotencyKey: string        // sprečava duplu naplatu
  successUrl:     string
  cancelUrl:      string
  description?:   string
  metadata?:      Record<string, string>
}

// Normalizovani webhook event — isti format bez obzira na provajdera
export interface NormalizedEvent {
  providerRef:  string
  status:       NormalizedStatus
  amountMinor?: number
  currency?:    string
  rawPayload:   unknown         // sačuvan za audit
}

export interface RefundResult {
  success:     boolean
  providerRef: string
  amountMinor: number
}

// Ugovor koji svaki provajder mora implementirati
export interface PaymentProvider {
  id: ProviderType
  createCheckoutSession(ctx: SessionCtx): Promise<{
    redirectUrl?:  string   // hosted redirect (Stripe Checkout) — frontend radi GET redirect
    clientSecret?: string   // Stripe embedded (opciono, kasnija faza)
    formPost?: {            // Monri v2 form — frontend radi POST auto-submit
      action: string
      fields: Record<string, string>
    }
    providerRef:   string   // ID transakcije kod provajdera
  }>
  verifyAndParseWebhook(rawBody: string, headers: Headers): Promise<NormalizedEvent>
  getStatus(providerRef: string): Promise<NormalizedStatus>
  refund(providerRef: string, amountMinor?: number): Promise<RefundResult>
}

// DB red iz tenant_payment_configs
export interface TenantPaymentConfig {
  id:                    string
  restaurant_id:         string
  provider:              ProviderType
  mode:                  'test' | 'live'
  is_active:             boolean
  is_default:            boolean
  credentials_secret_id?: string
  public_config:         Record<string, unknown>
}
