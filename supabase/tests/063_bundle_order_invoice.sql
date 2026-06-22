-- ============================================================================
-- DB test: Faza 4 — naručivanje paketa → fiskalni reader.
-- Provjerava da create_invoice_from_order:
--   • fakturiše HEADER paketa (bundle_price) sa PDV iz menu_bundles.vat_rate_key,
--   • IZOSTAVLJA komponente (is_bundle_component, 0€) — nema 0€ stavki na računu,
--   • komponente ostaju u order_items (kuhinja ih vidi).
-- BEGIN…ROLLBACK. UUID prostor dddddddd-b011-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('bo_owner');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('dddddddd-b011-b011-b011-b011b011a001', tests.get_supabase_uid('bo_owner'), 'Bundle Order', 'bundle-order', 'EUR');

INSERT INTO categories (id, restaurant_id, name) VALUES
  ('dddddddd-b011-b011-b011-b011b011a101', 'dddddddd-b011-b011-b011-b011b011a001', 'Glavna');
INSERT INTO menu_items (id, restaurant_id, category_id, name, price, vat_rate_key) VALUES
  ('dddddddd-b011-b011-b011-b011b011a201', 'dddddddd-b011-b011-b011-b011b011a001', 'dddddddd-b011-b011-b011-b011b011a101', 'Pica', 12.00, 'STANDARD'),
  ('dddddddd-b011-b011-b011-b011b011a202', 'dddddddd-b011-b011-b011-b011b011a001', 'dddddddd-b011-b011-b011-b011b011a101', 'Sok', 3.00, 'STANDARD');

-- Paket (STANDARD 21%), naplaćena cijena 20.00.
INSERT INTO menu_bundles (id, restaurant_id, name, bundle_price, vat_rate_key, is_active) VALUES
  ('dddddddd-b011-b011-b011-b011b011a301', 'dddddddd-b011-b011-b011-b011b011a001', 'Combo', 20.00, 'STANDARD', true);

-- Narudžba: header paketa (20.00) + 2 komponente (0€, informativne).
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a001', '7', 'served', 20.00);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity, bundle_id, is_bundle_component) VALUES
  ('dddddddd-b011-b011-b011-b011b011a401', NULL, 'dddddddd-b011-b011-b011-b011b011a001', 'Combo', 20.00, 1, 'dddddddd-b011-b011-b011-b011b011a301', false),
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a201', 'dddddddd-b011-b011-b011-b011b011a001', 'Pica', 0, 2, 'dddddddd-b011-b011-b011-b011b011a301', true),
  ('dddddddd-b011-b011-b011-b011b011a401', 'dddddddd-b011-b011-b011-b011b011a202', 'dddddddd-b011-b011-b011-b011b011a001', 'Sok', 0, 2, 'dddddddd-b011-b011-b011-b011b011a301', true);

SELECT tests.authenticate_as('bo_owner');

-- (1) reader kreira račun
SELECT lives_ok(
  $$ SELECT create_invoice_from_order('dddddddd-b011-b011-b011-b011b011a401') $$,
  'create_invoice_from_order radi sa paketom u narudžbi');

-- (2) samo HEADER fakturisan (1 stavka) — komponente izostavljene
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.source_id='dddddddd-b011-b011-b011-b011b011a401' $$,
  ARRAY[1],
  'Na računu samo header paketa (komponente 0€ izostavljene)');

-- (3) total = 20.00 sa PDV 21% iz paketa (osnovica 16.53 + PDV 3.47)
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices
     WHERE source_id='dddddddd-b011-b011-b011-b011b011a401' $$,
  $$ VALUES (2000, 1653, 347) $$,
  'Header paketa fakturisan 20.00 @STANDARD 21% (PDV iz menu_bundles.vat_rate_key)');

-- (4) komponente ostaju u order_items (kuhinja ih vidi)
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items
     WHERE order_id='dddddddd-b011-b011-b011-b011b011a401' AND is_bundle_component = true $$,
  ARRAY[2],
  'Komponente paketa ostaju u order_items (za kuhinju)');

SELECT * FROM finish();
ROLLBACK;
