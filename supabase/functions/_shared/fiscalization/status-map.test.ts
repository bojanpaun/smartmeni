// ============================================================================
// Edge/Deno test: normalizacija fiskalnog statusa (status-map.ts).
// App sloj nikad ne vidi provajder-specifičan string — sve → NormalizedFiscalStatus.
// Najopasnija tiha regresija: 'rejected'/'error' → 'fiscalized' (neuspjelo tretirano
// kao fiskalizovano). Ovi testovi zaključavaju mape.
//
// Pokretanje:  deno test supabase/functions/_shared/fiscalization/status-map.test.ts
// ============================================================================

import { assertEquals } from 'jsr:@std/assert'
import { mapFiscalStatus } from './status-map.ts'

const ALLOWED = new Set(['pending', 'queued', 'fiscalized', 'failed'])

Deno.test('Fisver: uspjeh → fiscalized', () => {
  assertEquals(mapFiscalStatus('fisver', 'registered'), 'fiscalized')
  assertEquals(mapFiscalStatus('fisver', 'ACCEPTED'), 'fiscalized')
})

Deno.test('Fisver: neuspjeh → failed (nikad fiscalized)', () => {
  assertEquals(mapFiscalStatus('fisver', 'rejected'), 'failed')
  assertEquals(mapFiscalStatus('fisver', 'error'), 'failed')
})

Deno.test('Fisver: red/u toku → queued', () => {
  assertEquals(mapFiscalStatus('fisver', 'queued'), 'queued')
  assertEquals(mapFiscalStatus('fisver', 'processing'), 'queued')
})

Deno.test('Nepoznat status → pending (siguran default)', () => {
  assertEquals(mapFiscalStatus('fisver', 'nesto_novo'), 'pending')
  assertEquals(mapFiscalStatus('fisver', ''), 'pending')
  assertEquals(mapFiscalStatus('nepoznat_provajder', 'registered'), 'pending')
})

Deno.test('Svi izlazi su validni NormalizedFiscalStatus', () => {
  for (const raw of ['registered', 'accepted', 'queued', 'pending', 'rejected', 'error', 'xyz']) {
    assertEquals(ALLOWED.has(mapFiscalStatus('fisver', raw)), true)
  }
})
