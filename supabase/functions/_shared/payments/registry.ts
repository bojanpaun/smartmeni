import type { PaymentProvider, TenantPaymentConfig } from './types.ts'
import { StripeProvider } from './stripe.ts'
// PAY-8: import { MonriProvider } from './monri.ts'

export function getProvider(
  config: TenantPaymentConfig,
  credentials: Record<string, string>,
): PaymentProvider {
  switch (config.provider) {
    case 'stripe':
      return new StripeProvider(credentials, config.mode)
    case 'monri':
      // PAY-8: return new MonriProvider(credentials, config.mode, config.public_config)
      throw new Error('Monri provajder još nije implementiran (PAY-8)')
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

// Čita kredencijale iz payment_credentials tabele (service_role — bypass RLS)
// Poziva se SAMO iz Edge Functions koje imaju SUPABASE_SERVICE_ROLE_KEY
// deno-lint-ignore no-explicit-any
export async function getCredentials(
  supabase: any,
  configId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('payment_credentials')
    .select('credentials')
    .eq('config_id', configId)
    .maybeSingle()

  if (error) {
    console.error('[registry] getCredentials error:', error.message)
    return {}
  }
  return (data?.credentials as Record<string, string>) ?? {}
}
