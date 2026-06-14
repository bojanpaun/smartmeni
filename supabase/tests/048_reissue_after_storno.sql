-- ============================================================================
-- DB test: ponovno izdavanje/razdvajanje nakon storna.
-- Izvor je „fakturisan" samo dok ima AKTIVAN (nestorniran) original; storno ga
-- vraća u „Za izdavanje" i dozvoljava re-split. BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('rs_owner');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('cccccccc-0000-0000-0000-0000000000d1', tests.get_supabase_uid('rs_owner'), 'Reissue Test', 'reissue-test', 'EUR');
INSERT INTO menu_items (id, restaurant_id, name, price, vat_rate_key) VALUES
  ('cccccccc-0000-0000-0000-0000000000d2', 'cccccccc-0000-0000-0000-0000000000d1', 'Burger', 12.10, 'STANDARD');
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('cccccccc-0000-0000-0000-0000000000d3', 'cccccccc-0000-0000-0000-0000000000d1', '9', 'closed', 12.10);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('cccccccc-0000-0000-0000-0000000000d3', 'cccccccc-0000-0000-0000-0000000000d2', 'cccccccc-0000-0000-0000-0000000000d1', 'Burger', 12.10, 1);

SELECT tests.authenticate_as('rs_owner');

-- ── 1) Izdaj jedan račun → izvor ima aktivan original ───────────────────────
SELECT create_invoice_from_order('cccccccc-0000-0000-0000-0000000000d3');
SELECT is(
  (SELECT count(*)::int FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000d3' AND corrective_for IS NULL),
  1, 'Nakon izdavanja: 1 original');

-- ── 2) Izvor NIJE u „Za izdavanje" (ima aktivan original) ───────────────────
SELECT is(
  (SELECT EXISTS (SELECT 1 FROM get_unbilled_sources('cccccccc-0000-0000-0000-0000000000d1', 50) WHERE source_id='cccccccc-0000-0000-0000-0000000000d3')),
  false, 'Izdat izvor nije u „Za izdavanje"');

-- ── 3) Storno → izvor se vraća u „Za izdavanje" ─────────────────────────────
SELECT create_storno_invoice((SELECT id FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000d3' AND corrective_for IS NULL));
SELECT is(
  (SELECT EXISTS (SELECT 1 FROM get_unbilled_sources('cccccccc-0000-0000-0000-0000000000d1', 50) WHERE source_id='cccccccc-0000-0000-0000-0000000000d3')),
  true, 'Nakon storna: izvor opet u „Za izdavanje"');

-- ── 4) Re-split sada prolazi (2 nova aktivna originala) ─────────────────────
SELECT create_split_invoices(
  'cccccccc-0000-0000-0000-0000000000d1', 'order', 'cccccccc-0000-0000-0000-0000000000d3',
  '[[{"name":"Burger","quantity":1,"unit_price_cents":605,"vat_rate_key":"STANDARD"}],
    [{"name":"Burger","quantity":1,"unit_price_cents":605,"vat_rate_key":"STANDARD"}]]'::jsonb);
SELECT is(
  (SELECT count(*)::int FROM invoices i WHERE i.source_id='cccccccc-0000-0000-0000-0000000000d3'
     AND i.corrective_for IS NULL AND NOT EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for=i.id)),
  2, 'Nakon re-splita: 2 aktivna originala');

-- ── 5) Ponovni create_invoice_from_order ne pravi novi (vraća aktivan) ──────
SELECT create_invoice_from_order('cccccccc-0000-0000-0000-0000000000d3');
SELECT is(
  (SELECT count(*)::int FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000d3' AND corrective_for IS NULL),
  3, 'Idempotentno: i dalje 3 originala (1 stornirani + 2 split), bez duplikata');

SELECT * FROM finish();
ROLLBACK;
