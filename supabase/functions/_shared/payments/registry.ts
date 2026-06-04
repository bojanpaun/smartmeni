import type { PaymentProvider, TenantPaymentConfig } from './types.ts'
import { StubProvider } from './stub.ts'

// Lazy import Stripe/Monri — importuju se tek kad su implementirani (PAY-6 / PAY-8)
// Da bi se dodao novi provajder: importuj klasu i dodaj case u getProvider()

export function getProvider(
  config: TenantPaymentConfig,
  credentials: Record<string, string>,
): PaymentProvider {
  switch (config.provider) {
    case 'stripe': {
      // PAY-6: zamijeniti StubProvider sa StripeProvider
      // import { StripeProvider } from './stripe.ts'
      // return new StripeProvider(credentials, config.mode)
      return new StubProvider()
    }
    case 'monri': {
      // PAY-8: zamijeniti StubProvider sa MonriProvider
      // import { MonriProvider } from './monri.ts'
      // return new MonriProvider(credentials, config.mode, config.public_config)
      return new StubProvider()
    }
    default:
      throw new Error(`Payment provajder '${config.provider}' nije implementiran`)
  }
}

// Dohvata aktivan/default config za tenant iz baze
// deno-lint-ignore no-explicit-any
export async function getActiveTenantConfig(
  supabase: any,
  restaurantId: string,
): Promise<TenantPaymentConfig | null> {
  const { data, error } = await supabase
    .from('tenant_payment_configs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (error) console.error('[registry] getActiveTenantConfig error:', error)
  return data ?? null
}

// Čita kredencijale iz Supabase Vault (PAY-3 dopuna)
// deno-lint-ignore no-explicit-any
export async function getCredentials(
  supabase: any,
  secretId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('vault_get_secret', { secret_id: secretId })
  if (error || !data) {
    console.error('[registry] vault read error:', error)
    return {}
  }
  try { return JSON.parse(data) } catch { return {} }
}
