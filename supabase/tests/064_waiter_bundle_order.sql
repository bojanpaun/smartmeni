-- ============================================================================
-- DB test: waiter_submit_order + paket (StaffPortal naručivanje paketa, Faza 4).
-- Konobar šalje paket = komponente (puna cijena) + negativna stavka popusta (vat_rate_key).
-- Provjera: total = bundle_price, stavke ubačene sa bundle poljima, routing po artiklima.
-- BEGIN…ROLLBACK. UUID prostor dddddddd-b022-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('wb_owner');
SELECT tests.create_supabase_user('wb_staff');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-b022-b022-b022-b022b022a001', tests.get_supabase_uid('wb_owner'), 'WB', 'wb');
INSERT INTO staff (id, restaurant_id, user_id, email, is_active) VALUES
  ('dddddddd-b022-b022-b022-b022b022a011', 'dddddddd-b022-b022-b022-b022b022a001', tests.get_supabase_uid('wb_staff'), 'wb@a.test', true);

INSERT INTO categories (id, restaurant_id, name, is_bar) VALUES
  ('dddddddd-b022-b022-b022-b022b022a101', 'dddddddd-b022-b022-b022-b022b022a001', 'Hrana', false);
INSERT INTO menu_items (id, restaurant_id, category_id, name, price, vat_rate_key) VALUES
  ('dddddddd-b022-b022-b022-b022b022a201', 'dddddddd-b022-b022-b022-b022b022a001', 'dddddddd-b022-b022-b022-b022b022a101', 'Pica', 10.00, 'STANDARD'),
  ('dddddddd-b022-b022-b022-b022b022a202', 'dddddddd-b022-b022-b022-b022b022a001', 'dddddddd-b022-b022-b022-b022b022a101', 'Sok', 5.00, 'STANDARD');
INSERT INTO menu_bundles (id, restaurant_id, name, bundle_price, is_active) VALUES
  ('dddddddd-b022-b022-b022-b022b022a301', 'dddddddd-b022-b022-b022-b022b022a001', 'Combo', 20.00, true);

SELECT tests.authenticate_as('wb_staff');

-- Konobar šalje paket (komponente + popust −5)
SELECT results_eq(
  $$ SELECT total::text FROM waiter_submit_order(
       'dddddddd-b022-b022-b022-b022b022a001', '4',
       '[{"menu_item_id":"dddddddd-b022-b022-b022-b022b022a201","name":"Pica","price":10.00,"quantity":2,"category_id":"dddddddd-b022-b022-b022-b022b022a101","bundle_id":"dddddddd-b022-b022-b022-b022b022a301","is_bundle_component":true},
         {"menu_item_id":"dddddddd-b022-b022-b022-b022b022a202","name":"Sok","price":5.00,"quantity":1,"category_id":"dddddddd-b022-b022-b022-b022b022a101","bundle_id":"dddddddd-b022-b022-b022-b022b022a301","is_bundle_component":true},
         {"menu_item_id":null,"name":"Popust: Combo (−20%)","price":-5.00,"quantity":1,"bundle_id":"dddddddd-b022-b022-b022-b022b022a301","is_bundle_component":false,"vat_rate_key":"STANDARD"}]'::jsonb,
       'new') $$,
  ARRAY['20.00'],
  'Konobarski paket: total = bundle_price 20.00 (popust uračunat)');

-- 3 stavke ubačene
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = 'dddddddd-b022-b022-b022-b022b022a001' $$,
  ARRAY[3],
  'Ubačene komponente + stavka popusta (3)');

-- stavka popusta: bundle_id set, menu_item_id NULL, vat_rate_key, negativna
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = 'dddddddd-b022-b022-b022-b022b022a001'
       AND oi.bundle_id IS NOT NULL AND oi.menu_item_id IS NULL
       AND oi.vat_rate_key = 'STANDARD' AND oi.price < 0 $$,
  ARRAY[1],
  'Stavka popusta sačuvana (vat_rate_key + negativan iznos)');

-- routing: komponente su hrana → kitchen_status preparing
SELECT results_eq(
  $$ SELECT kitchen_status FROM orders WHERE restaurant_id = 'dddddddd-b022-b022-b022-b022b022a001' $$,
  ARRAY['preparing'],
  'Routing po komponentama: kuhinja = preparing');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
