import type { NormalizedFiscalStatus } from './types.ts'

// ── Fisver (ME) → NormalizedFiscalStatus ──────────────────────────
// App sloj nikad ne vidi provajder-specifičan string — sve se svodi na enum.
// Vrijednosti su placeholder dok se ne potvrdi Fisver API (FISK-3); dopuniti
// prema stvarnim statusima. Nepoznat status → 'pending' (siguran default, NE
// 'fiscalized' — tiha greška bi bila „neuspjelo → fiskalizovano").
const FISVER: Record<string, NormalizedFiscalStatus> = {
  'registered': 'fiscalized',
  'accepted':   'fiscalized',
  'success':    'fiscalized',
  'queued':     'queued',
  'processing': 'queued',
  'pending':    'pending',
  'rejected':   'failed',
  'error':      'failed',
  'failed':     'failed',
}

const STUB: Record<string, NormalizedFiscalStatus> = {
  'pending':    'pending',
  'queued':     'queued',
  'fiscalized': 'fiscalized',
  'failed':     'failed',
}

export function mapFiscalStatus(provider: string, raw: string): NormalizedFiscalStatus {
  const key = (raw ?? '').toLowerCase()
  switch (provider) {
    case 'fisver': return FISVER[key] ?? 'pending'
    case 'stub':   return STUB[key] ?? 'pending'
    default:       return 'pending'
  }
}
