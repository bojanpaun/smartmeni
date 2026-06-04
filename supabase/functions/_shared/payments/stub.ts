// Stub provajder — koristi se za testiranje apstrakcije prije implementacije
// pravog Stripe/Monri provajdera (PAY-6 / PAY-8)
import type {
  PaymentProvider, SessionCtx, NormalizedEvent,
  NormalizedStatus, RefundResult,
} from './types.ts'

export class StubProvider implements PaymentProvider {
  readonly id = 'stripe' as const

  async createCheckoutSession(ctx: SessionCtx) {
    console.log('[StubProvider] createCheckoutSession', ctx.idempotencyKey)
    return {
      redirectUrl: `${ctx.successUrl}?stub=1&ref=stub_${ctx.idempotencyKey}`,
      providerRef: `stub_${ctx.idempotencyKey}`,
    }
  }

  async verifyAndParseWebhook(_rawBody: string, _headers: Headers): Promise<NormalizedEvent> {
    return {
      providerRef: 'stub_ref',
      status:      'paid',
      rawPayload:  { stub: true },
    }
  }

  async getStatus(_providerRef: string): Promise<NormalizedStatus> {
    return 'paid'
  }

  async refund(providerRef: string, amountMinor = 0): Promise<RefundResult> {
    return { success: true, providerRef, amountMinor }
  }
}
