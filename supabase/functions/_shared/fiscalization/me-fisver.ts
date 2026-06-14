// ME Fisver provajder — SKELET (dormant). Pravi pozivi ka poreskoj upravi se
// implementiraju TEK po potvrdi: (a) Fisver ugovora/integratorskog modela,
// (b) onboardinga certifikata po tenantu (Pošta CG / CoreIT), (c) tačnog formata
// broja računa za ME. Do tada baca jasnu grešku da nije konfigurisan (kao Monri
// dok tenant ne unese ključeve). Vidi roadmap „Otvorene odluke (BLOCKING)".
import type {
  FiscalizationProvider, InvoiceDraft, FiscalRegisterResult,
  NormalizedFiscalStatus, TenantFiscalConfig,
} from './types.ts'

const NOT_READY = 'Fisver provajder još nije konfigurisan (čeka ugovor + certifikat) — FISK-3'

export class FisverProvider implements FiscalizationProvider {
  readonly id = 'fisver' as const

  // deno-lint-ignore no-unused-vars
  constructor(
    private readonly credentials: Record<string, string>,
    private readonly config: TenantFiscalConfig,
  ) {}

  // TODO(FISK-3): potpis IKOF-a privatnim ključem, SOAP/REST poziv Fisver-u,
  // izvlačenje JIKR-a + QR-a, mapiranje statusa kroz status-map.ts.
  async registerInvoice(_draft: InvoiceDraft): Promise<FiscalRegisterResult> {
    throw new Error(NOT_READY)
  }

  async getStatus(_providerRef: string): Promise<NormalizedFiscalStatus> {
    throw new Error(NOT_READY)
  }

  async healthCheck(): Promise<boolean> {
    return false // dormant dok se ne konfiguriše
  }
}
