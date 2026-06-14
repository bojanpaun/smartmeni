-- ============================================================================
-- DB test: per-tenant PDV stope (restaurants.tax_rates) — override + fallback.
-- create_invoice_from_items koristi EFEKTIVNE stope (tenant → država). BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('tr_owner');

-- Tenant A: vlastite stope (CUSTOM 10%).
INSERT INTO restaurants (id, user_id, name, slug, currency, tax_rates) VALUES
  ('cccccccc-0000-0000-0000-0000000000e1', tests.get_supabase_uid('tr_owner'), 'Tax A', 'tax-a', 'EUR',
   '[{"key":"CUSTOM","value":0.10,"label":"Custom 10%"}]'::jsonb);
-- Tenant B: bez override-a (fallback na državne ME STANDARD 21%).
INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('cccccccc-0000-0000-0000-0000000000e2', tests.get_supabase_uid('tr_owner'), 'Tax B', 'tax-b', 'EUR');

SELECT tests.authenticate_as('tr_owner');

-- ── 1) Tenant override: 11.00 @ 10% → osnovica 10.00 + PDV 1.00 ──────────────
SELECT create_invoice_from_items(
  'cccccccc-0000-0000-0000-0000000000e1', 'order', NULL, 'tr-a-1',
  '[{"name":"A","quantity":1,"unit_price_cents":1100,"vat_rate_key":"CUSTOM"}]'::jsonb);
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices WHERE idempotency_key='tr-a-1' $$,
  $$ VALUES (1100, 1000, 100) $$,
  'Tenant override stopa (10%): 11.00 → 10.00 + 1.00');

-- ── 2) Fallback na državnu: 12.10 @ STANDARD 21% → 10.00 + 2.10 ─────────────
SELECT create_invoice_from_items(
  'cccccccc-0000-0000-0000-0000000000e2', 'order', NULL, 'tr-b-1',
  '[{"name":"B","quantity":1,"unit_price_cents":1210,"vat_rate_key":"STANDARD"}]'::jsonb);
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices WHERE idempotency_key='tr-b-1' $$,
  $$ VALUES (1210, 1000, 210) $$,
  'Bez override-a: fallback na državnu STANDARD 21%');

SELECT * FROM finish();
ROLLBACK;
