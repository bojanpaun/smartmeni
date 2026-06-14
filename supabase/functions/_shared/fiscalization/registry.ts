import type { FiscalizationProvider, TenantFiscalConfig } from './types.ts'
import { StubFiscalProvider } from './stub.ts'
import { FisverProvider } from './me-fisver.ts'

// Vrati instancu fiskalnog provajdera za config (kalup kao payments getProvider).
export function getFiscalProvider(
  config: TenantFiscalConfig,
  credentials: Record<string, string>,
): FiscalizationProvider {
  switch (config.provider) {
    case 'fisver': return new FisverProvider(credentials, config)
    case 'stub':   return new StubFiscalProvider()
    default:
      throw new Error(`Fiskalni provajder '${config.provider}' nije implementiran`)
  }
}

// Aktivan/default fiskalni config tenanta.
// deno-lint-ignore no-explicit-any
export async function getActiveTenantFiscalConfig(
  supabase: any,
  restaurantId: string,
): Promise<TenantFiscalConfig | null> {
  const { data, error } = await supabase
    .from('tenant_fiscal_configs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()
  if (error) console.error('[fiscal registry] getActiveTenantFiscalConfig:', error)
  return data ?? null
}

// Čita kredencijale iz fiscal_credentials (service_role — bypass RLS; tabela nema
// SELECT politiku za authenticated). Poziva se SAMO iz Edge Functions.
// deno-lint-ignore no-explicit-any
export async function getFiscalCredentials(
  supabase: any,
  configId: string,
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('fiscal_credentials')
    .select('credentials')
    .eq('config_id', configId)
    .maybeSingle()
  if (error) { console.error('[fiscal registry] getFiscalCredentials:', error.message); return {} }
  return (data?.credentials as Record<string, string>) ?? {}
}
