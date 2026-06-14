// Stub fiskalni provajder — za testiranje apstrakcije i DORMANT rad dok pravi
// provajder (Fisver) nije konfigurisan. NE registruje stvarno kod poreske uprave;
// vraća 'pending' (račun ostaje nefiskalizovan ali validan/numerisan).
import type {
  FiscalizationProvider, InvoiceDraft, FiscalRegisterResult, NormalizedFiscalStatus,
} from './types.ts'

export class StubFiscalProvider implements FiscalizationProvider {
  readonly id = 'stub' as const

  async registerInvoice(draft: InvoiceDraft): Promise<FiscalRegisterResult> {
    console.log('[StubFiscalProvider] registerInvoice', draft.invoiceNumber)
    return { providerRef: `stub_${draft.invoiceId}`, status: 'pending', raw: { stub: true } }
  }

  async getStatus(_providerRef: string): Promise<NormalizedFiscalStatus> {
    return 'pending'
  }

  async healthCheck(): Promise<boolean> {
    return true
  }
}
