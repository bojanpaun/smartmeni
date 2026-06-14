-- ============================================================================
-- DB test: FISK-2c — create_invoice_from_items (assembly + atomarna numeracija)
-- + invoices RLS. Pokriva: PDV obračun, invarijanta total_base+total_vat==total,
-- idempotencija, neprekidan niz ordinala (bez rupa), RLS izolacija, ovlašćenje.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(10);

SELECT tests.create_supabase_user('inv_owner');
SELECT tests.create_supabase_user('inv_other');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('44444444-4444-4444-4444-444444444444', tests.get_supabase_uid('inv_owner'), 'Inv Test', 'inv-test', 'EUR');

SELECT tests.authenticate_as('inv_owner');

-- ── Test 1: vlasnik kreira račun ────────────────────────────────────────────
SELECT lives_ok(
  $$ SELECT create_invoice_from_items(
       '44444444-4444-4444-4444-444444444444', 'order', NULL, 'idem-1',
       '[{"name":"Kafa","quantity":1,"unit_price_cents":12100,"vat_rate_key":"STANDARD"}]'::jsonb) $$,
  'Vlasnik kreira račun (order)'
);

-- ── Test 2: PDV 21% iz bruto 121.00 → osnovica 100.00 + PDV 21.00 ───────────
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices WHERE idempotency_key='idem-1' $$,
  $$ VALUES (12100, 10000, 2100) $$,
  'PDV 21%: 121.00 → osnovica 100.00 + PDV 21.00'
);

-- ── Test 3: prvi račun ordinal=1 ────────────────────────────────────────────
SELECT results_eq(
  $$ SELECT invoice_ordinal FROM invoices WHERE idempotency_key='idem-1' $$,
  ARRAY[1],
  'Prvi račun ordinal=1'
);

-- ── Test 4: idempotencija — isti ključ ne pravi novi račun ──────────────────
SELECT lives_ok(
  $$ SELECT create_invoice_from_items('44444444-4444-4444-4444-444444444444','order',NULL,'idem-1',
       '[{"name":"x","quantity":1,"unit_price_cents":12100,"vat_rate_key":"STANDARD"}]'::jsonb) $$,
  'Ponovni poziv s istim ključem prolazi (idempotentno)'
);
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoices WHERE restaurant_id='44444444-4444-4444-4444-444444444444' $$,
  ARRAY[1],
  'Idempotencija: i dalje tačno 1 račun'
);

-- ── Setup za niz: još 2 računa ──────────────────────────────────────────────
SELECT create_invoice_from_items('44444444-4444-4444-4444-444444444444','order',NULL,'idem-2',
  '[{"name":"Pivo","quantity":2,"unit_price_cents":5750,"vat_rate_key":"HOSP"}]'::jsonb);
SELECT create_invoice_from_items('44444444-4444-4444-4444-444444444444','order',NULL,'idem-3','[]'::jsonb);

-- ── Test 5: neprekidan niz ordinala 1,2,3 (bez rupa) ────────────────────────
SELECT results_eq(
  $$ SELECT array_agg(invoice_ordinal ORDER BY invoice_ordinal) FROM invoices
     WHERE restaurant_id='44444444-4444-4444-4444-444444444444' $$,
  $$ VALUES (ARRAY[1,2,3]) $$,
  'Neprekidan niz ordinala 1,2,3 (bez rupa)'
);

-- ── Test 6: invarijanta total_base+total_vat==total na SVIM računima ────────
SELECT is_empty(
  $$ SELECT id FROM invoices WHERE total_base_cents + total_vat_cents <> total_cents $$,
  'Invarijanta: total_base + total_vat == total_cents'
);

-- ── Test 7: HOSP 2×57.50 = bruto 115.00 ─────────────────────────────────────
SELECT results_eq(
  $$ SELECT total_cents FROM invoices WHERE idempotency_key='idem-2' $$,
  ARRAY[11500],
  'HOSP 2×57.50 → bruto 115.00'
);

-- ── Test 8: RLS — drugi tenant ne vidi tuđe račune ──────────────────────────
SELECT tests.authenticate_as('inv_other');
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoices WHERE restaurant_id='44444444-4444-4444-4444-444444444444' $$,
  ARRAY[0],
  'RLS: drugi korisnik ne vidi tuđe račune'
);

-- ── Test 9: ne-vlasnik ne može kreirati račun (42501) ───────────────────────
SELECT throws_ok(
  $$ SELECT create_invoice_from_items('44444444-4444-4444-4444-444444444444','order',NULL,'idem-x','[]'::jsonb) $$,
  '42501',
  NULL,
  'Ne-vlasnik/ne-staff ne može kreirati račun (RLS ovlašćenja)'
);

SELECT * FROM finish();
ROLLBACK;
