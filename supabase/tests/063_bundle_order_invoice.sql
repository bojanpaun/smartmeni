-- ============================================================================
-- DB test: Faza 4b — paket na računu PO ARTIKLIMA + vidljiv popust.
-- create_invoice_from_order treba da:
--   • fakturiše KOMPONENTE po punoj cijeni (svaka svoj PDV),
--   • uključi negativnu stavku "Popust" (vat_rate_key na order_items),
--   • ukupno = bundle_price (popust netuje PDV grupu),
--   • komponente ostaju u order_items (kuhinja).
-- BEGIN…ROLLBACK. UUID prostor dddddddd-b011-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('bo_owner');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('dddddddd-b011-b011-b011-b011b011a001', tests.get_supabase_uid('bo_owner'), 'Bundle Order', 'bundle-order', 'EUR');

INSERT INTO categories (id, restaurant_id, name) VALUES
  ('dddddddd-b011-b011-b011-b011b011a101', 'dddddddd-b011-b011-b011-b011b011a001', 'Glavna');
INSERT INTO menu_items (id, restaurant_id, category_id, name, price, vat_rate_key) VALUES
  ('dddddddd-b011-b011-b011-b011b011a201', 'dddddddd-b011-b011-b011-b011b011a001', 'dddddddd-b011-b011-b011-b011b011a101', 'Pica', 10.00, 'STANDARD'),
  ('dddddddd-b011-b011-b011-b011b011a202', 'dddddddd-b011-b011-b011-b011b011a001', 'dddddddd-b011-b011-b011-b011b011a101', 'Sok', 5.00, 'STANDARD');

INSERT INTO menu_bundles (id, restaurant_id, name, bundle_price, is_active) VALUES
  ('dddddddd-b011-b011-b011-b011b011a301', 'dddddddd-b011-b011-b011-b011b011a001', 'Combo', 20.00, true);

-- Narudžba: komponente po punoj cijeni (2×Pica=20, 1×Sok=5 → 25) + popust −5 = 20.
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a001', '7', 'served', 20.00);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity, bundle_id, is_bundle_component, vat_rate_key) VALUES
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a201', 'dddddddd-b011-b011-b011-b011b011a001', 'Pica', 10.00, 2, 'dddddddd-b011-b011-b011-b011b011a301', true, NULL),
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a202', 'dddddddd-b011-b011-b011-b011b011a001', 'Sok', 5.00, 1, 'dddddddd-b011-b011-b011-b011b011a301', true, NULL),
  ('dddddddd-b011-b011-b011-b011b011a401', NULL, 'dddddddd-b011-b011-b011-b011b011a001', 'Popust: Combo (−20%)', -5.00, 1, 'dddddddd-b011-b011-b011-b011b011a301', false, 'STANDARD');

SELECT tests.authenticate_as('bo_owner');

-- (1) reader kreira račun
SELECT lives_ok(
  $$ SELECT create_invoice_from_order('dddddddd-b011-b011-b011-b011b011a401') $$,
  'create_invoice_from_order radi sa paketom (po artiklima)');

-- (2) tri stavke na računu: 2 artikla + 1 popust
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.source_id='dddddddd-b011-b011-b011-b011b011a401' $$,
  ARRAY[3],
  'Račun ima artikle pojedinačno + stavku popusta');

-- (3) postoji NEGATIVNA stavka (popust je vidljiv)
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.source_id='dddddddd-b011-b011-b011-b011b011a401' AND ii.total_cents < 0 $$,
  ARRAY[1],
  'Popust je zasebna (negativna) stavka na računu');

-- (4) total = 20.00 @STANDARD 21% (osnovica 16.53 + PDV 3.47) — popust netuje grupu
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices
     WHERE source_id='dddddddd-b011-b011-b011-b011b011a401' $$,
  $$ VALUES (2000, 1653, 347) $$,
  'Ukupno = bundle_price 20.00 (popust uračunat u PDV grupu)');

-- (5) komponente ostaju u order_items (kuhinja ih vidi)
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items
     WHERE order_id='dddddddd-b011-b011-b011-b011b011a401' AND is_bundle_component = true $$,
  ARRAY[2],
  'Komponente paketa ostaju u order_items (za kuhinju)');

SELECT * FROM finish();
ROLLBACK;
