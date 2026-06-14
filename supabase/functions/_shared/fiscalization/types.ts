// ── Normalizovan fiskalni status ──────────────────────────────────
// Jedini dozvoljeni statusi u app sloju (mapira na invoices.fiscal_status:
// PENDING/QUEUED/FISCALIZED/FAILED). Nikad provajder-specifičan string.
export type NormalizedFiscalStatus = 'pending' | 'queued' | 'fiscalized' | 'failed'

export type FiscalProviderType = 'fisver' | 'stub'

// Nacrt računa za registraciju kod poreske uprave (gradi se iz invoices/invoice_items
// + tenant_fiscal_configs + restaurants seller blok). Iznosi u centima (Princip 2).
export interface InvoiceDraft {
  invoiceId:         string
  invoiceNumber:     string
  issuedAt:          string
  currency:          string
  kind:              string          // CASH_B2C / NONCASH_B2B …
  buyerTin?:         string          // samo B2B
  enuCode?:          string
  businessUnitCode?: string
  operatorCode?:     string
  totalCents:        number
  totalBaseCents:    number
  totalVatCents:     number
  items: Array<{
    name:           string
    quantity:       number
    unitPriceCents: number
    vatRateKey:     string | null
    baseCents:      number
    vatCents:       number
    totalCents:     number
  }>
  seller: {
    name?:      string
    taxId?:     string   // PIB
    vatNumber?: string   // PDV broj
    address?:   string
  }
}

// Rezultat registracije kod provajdera/poreske uprave.
export interface FiscalRegisterResult {
  providerRef:     string                  // referenca kod provajdera
  status:          NormalizedFiscalStatus
  protectiveCode?: string                  // IKOF
  fiscalCode?:     string                  // JIKR
  qrData?:         string
  raw:             unknown                  // sačuvan za audit
}

// Ugovor koji svaki fiskalni provajder mora implementirati (kalup kao PaymentProvider).
export interface FiscalizationProvider {
  id: FiscalProviderType
  registerInvoice(draft: InvoiceDraft): Promise<FiscalRegisterResult>
  getStatus(providerRef: string): Promise<NormalizedFiscalStatus>
  healthCheck(): Promise<boolean>
}

// DB red iz tenant_fiscal_configs
export interface TenantFiscalConfig {
  id:                     string
  restaurant_id:          string
  provider:               FiscalProviderType
  country:                string
  mode:                   'test' | 'live'
  enu_code?:              string
  business_unit_code?:    string
  operator_code?:         string
  is_active:              boolean
  is_default:             boolean
  credentials_secret_id?: string
  public_config:          Record<string, unknown>
}
