-- ============================================================================
-- payment_transactions.source_type — dodaj 'rental' (Faza RENT-0b, 4. payment tačka).
-- ----------------------------------------------------------------------------
-- KRITIČNO (ISPRAVKA v2.1): webhook (payments-webhook) upisuje payment_transactions
-- red sa source_type='rental'. Bez proširenja ovog CHECK-a INSERT puca na constraint
-- violation i naplata najma tiho pada. Migracije su nepromjenjive → DROP + ADD.
-- Uz ovu DB-tačku idu 3 edge-tačke: _shared/payments/types.ts (SourceType union),
-- payments-create-session (whitelist), payments-webhook (updateSource rental grana).
-- ============================================================================

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_source_type_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_source_type_check
  CHECK (source_type IN ('booking', 'folio', 'order', 'spa', 'rental'));
