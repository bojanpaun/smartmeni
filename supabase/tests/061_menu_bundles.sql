-- ============================================================================
-- DB test: menu_bundles + menu_bundle_items — RLS izolacija.
-- Aktivni paketi su NAMJERNO javni (gost na meniju ih čita) → testiramo da:
--   • neaktivan paket NIJE vidljiv drugom tenantu,
--   • aktivan paket JESTE javan,
--   • pisanje je izolovano (WITH CHECK),
--   • kaskade rade (paket→stavke, artikal→stavka).
-- BEGIN…ROLLBACK. UUID prostor dddddddd-b00d-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('bnd_a');
SELECT tests.create_supabase_user('bnd_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da001', tests.get_supabase_uid('bnd_a'), 'Bnd A', 'bnd-a'),
  ('dddddddd-b00d-b00d-b00d-b00db00db001', tests.get_supabase_uid('bnd_b'), 'Bnd B', 'bnd-b');

INSERT INTO categories (id, restaurant_id, name) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da101', 'dddddddd-b00d-b00d-b00d-b00db00da001', 'Glavna');
INSERT INTO menu_items (id, restaurant_id, category_id, name, price) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da201', 'dddddddd-b00d-b00d-b00d-b00db00da001',
   'dddddddd-b00d-b00d-b00d-b00db00da101', 'Pica', 10.00);

-- A: jedan AKTIVAN i jedan NEAKTIVAN paket
INSERT INTO menu_bundles (id, restaurant_id, name, bundle_price, is_active) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da301', 'dddddddd-b00d-b00d-b00d-b00db00da001', 'Combo aktivni', 8.00, true),
  ('dddddddd-b00d-b00d-b00d-b00db00da302', 'dddddddd-b00d-b00d-b00d-b00db00da001', 'Combo neaktivni', 7.00, false);
INSERT INTO menu_bundle_items (id, bundle_id, menu_item_id, restaurant_id, quantity) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da401', 'dddddddd-b00d-b00d-b00d-b00db00da301',
   'dddddddd-b00d-b00d-b00d-b00db00da201', 'dddddddd-b00d-b00d-b00d-b00db00da001', 2);

-- (1) RLS: vlasnik B ne vidi A-jev NEAKTIVAN paket
SELECT tests.authenticate_as('bnd_b');
SELECT is_empty(
  $$ SELECT 1 FROM menu_bundles WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da302' $$,
  'Vlasnik B ne vidi neaktivan paket tenanta A');

-- (2) AKTIVAN paket je javan (gost-scenario) — B ga vidi
SELECT isnt_empty(
  $$ SELECT 1 FROM menu_bundles WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da301' $$,
  'Aktivan paket je javno čitljiv (Ponuda dana za goste)');

-- (3) RLS WITH CHECK: B ne može upisati paket u A → 42501
SELECT throws_ok(
  $$ INSERT INTO menu_bundles (restaurant_id, name, bundle_price) VALUES ('dddddddd-b00d-b00d-b00d-b00db00da001', 'Hack', 1.00) $$,
  '42501', NULL, 'Vlasnik B ne može upisati paket u tuđi restoran');

-- (4) RLS WITH CHECK: B ne može upisati stavku paketa u A → 42501
SELECT throws_ok(
  $$ INSERT INTO menu_bundle_items (bundle_id, menu_item_id, restaurant_id, quantity)
     VALUES ('dddddddd-b00d-b00d-b00d-b00db00da301', 'dddddddd-b00d-b00d-b00d-b00db00da201', 'dddddddd-b00d-b00d-b00d-b00db00da001', 1) $$,
  '42501', NULL, 'Vlasnik B ne može upisati stavku u tuđi paket');

-- (5) CASCADE: brisanje paketa briše njegove stavke
SELECT tests.authenticate_as('bnd_a');
DELETE FROM menu_bundles WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da301';
SELECT is(
  (SELECT count(*)::int FROM menu_bundle_items WHERE bundle_id = 'dddddddd-b00d-b00d-b00d-b00db00da301'),
  0, 'Brisanje paketa kaskadno briše menu_bundle_items');

-- (6) CASCADE: brisanje artikla briše stavku paketa (ponovo seedujemo aktivan paket+stavku)
INSERT INTO menu_bundles (id, restaurant_id, name, bundle_price, is_active) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da303', 'dddddddd-b00d-b00d-b00d-b00db00da001', 'Combo 2', 8.00, true);
INSERT INTO menu_bundle_items (id, bundle_id, menu_item_id, restaurant_id, quantity) VALUES
  ('dddddddd-b00d-b00d-b00d-b00db00da402', 'dddddddd-b00d-b00d-b00d-b00db00da303',
   'dddddddd-b00d-b00d-b00d-b00db00da201', 'dddddddd-b00d-b00d-b00d-b00db00da001', 1);
DELETE FROM menu_items WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da201';
SELECT is(
  (SELECT count(*)::int FROM menu_bundle_items WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da402'),
  0, 'Brisanje artikla kaskadno briše menu_bundle_items');

-- (7) brisanje restorana A kaskadno briše pakete
DELETE FROM restaurants WHERE id = 'dddddddd-b00d-b00d-b00d-b00db00da001';
SELECT is(
  (SELECT count(*)::int FROM menu_bundles WHERE restaurant_id = 'dddddddd-b00d-b00d-b00d-b00db00da001'),
  0, 'Brisanje restorana kaskadno briše pakete');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
