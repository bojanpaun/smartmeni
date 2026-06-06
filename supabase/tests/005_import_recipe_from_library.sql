-- ============================================================================
-- Sloj 1 — DB test: import_recipe_from_library() RPC
-- ----------------------------------------------------------------------------
-- Kritična funkcija (20260606000004): preuzimanje recepta iz biblioteke u tenanta.
-- Pokriva happy path, idempotentnost, odbijanje neovlašćenog poziva i
-- ponašanje bez inventory_pro (samo menu_item, bez inventara/BOM-a).
--
-- Cijeli test radi u BEGIN ... ROLLBACK — NE dira prave podatke.
-- Pokretanje:  supabase test db
-- ============================================================================

BEGIN;

SELECT plan(8);

-- ── Setup (kao postgres — RLS se zaobilazi pri seedovanju) ──────────────────
SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

-- Tenant A = plaćeni plan (ima inventory_pro). Tenant B = starter (nema).
INSERT INTO restaurants (id, user_id, name, slug, plan) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', tests.get_supabase_uid('owner_a'), 'Kafić A', 'kafic-a-test', 'restaurant'),
  ('bbbbbbbb-0000-0000-0000-000000000002', tests.get_supabase_uid('owner_b'), 'Kafić B', 'kafic-b-test', 'starter');

-- Test recept u biblioteci (ne oslanjamo se na seed — test je samostalan).
INSERT INTO recipe_library (id, name, name_en, category, emoji, suggested_price, is_active) VALUES
  ('test_kafa', 'Test Kafa', 'Test Coffee', 'coffee', '☕', 2.00, true);
INSERT INTO recipe_library_ingredients (recipe_id, ingredient_name, quantity, unit, sort_order) VALUES
  ('test_kafa', 'Test Zrno',    7,   'g',  1),
  ('test_kafa', 'Test Mlijeko', 100, 'ml', 2);

-- ── Test 0: RLS uključen na katalogu ───────────────────────────────────────
SELECT tests.rls_enabled('public', 'recipe_library');

-- ── Vlasnik A preuzima recept (ima inventory_pro → menu + inventar + BOM) ───
SELECT tests.authenticate_as('owner_a');
SELECT import_recipe_from_library('test_kafa', 'aaaaaaaa-0000-0000-0000-000000000001');

-- Test 1: kreirana tačno 1 stavka menija za tenanta A.
SELECT results_eq(
  $$ SELECT count(*)::int FROM menu_items
      WHERE restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND name = 'Test Kafa' $$,
  ARRAY[1],
  'Import kreira menu_item za tenanta A'
);

-- Test 2: kreirane obje namirnice u inventaru (inventory_pro grana).
SELECT results_eq(
  $$ SELECT count(*)::int FROM inventory_items
      WHERE restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  ARRAY[2],
  'Import kreira namirnice u inventaru (inventory_pro)'
);

-- Test 3: kreiran BOM (2 veze sastojaka) za tu stavku.
SELECT results_eq(
  $$ SELECT count(*)::int FROM menu_item_ingredients mi
       JOIN menu_items m ON m.id = mi.menu_item_id
      WHERE m.restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  ARRAY[2],
  'Import kreira recept (menu_item_ingredients)'
);

-- ── Idempotentnost: ponovni import ne duplira stavku ───────────────────────
SELECT import_recipe_from_library('test_kafa', 'aaaaaaaa-0000-0000-0000-000000000001');
SELECT results_eq(
  $$ SELECT count(*)::int FROM menu_items
      WHERE restaurant_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND name = 'Test Kafa' $$,
  ARRAY[1],
  'Ponovni import ne duplira menu_item (find-or-create)'
);

-- ── Odbijanje: vlasnik B ne smije preuzeti u tenanta A ─────────────────────
SELECT tests.authenticate_as('owner_b');
SELECT throws_ok(
  $$ SELECT import_recipe_from_library('test_kafa', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'Nemate pravo na ovaj restoran',
  'Neovlašćeni tenant ne može preuzeti u tuđi restoran'
);

-- ── Starter tenant B: kreira menu_item, ali NE i inventar/BOM ───────────────
SELECT import_recipe_from_library('test_kafa', 'bbbbbbbb-0000-0000-0000-000000000002');
SELECT results_eq(
  $$ SELECT count(*)::int FROM menu_items
      WHERE restaurant_id = 'bbbbbbbb-0000-0000-0000-000000000002' AND name = 'Test Kafa' $$,
  ARRAY[1],
  'Starter tenant dobije menu_item'
);
SELECT results_eq(
  $$ SELECT count(*)::int FROM inventory_items
      WHERE restaurant_id = 'bbbbbbbb-0000-0000-0000-000000000002' $$,
  ARRAY[0],
  'Starter tenant NE dobije inventar (nema inventory_pro)'
);

SELECT * FROM finish();
ROLLBACK;
