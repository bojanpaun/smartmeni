-- ============================================================================
-- DB test: inventura (Inventory Pro v2 — Faza 3)
-- ----------------------------------------------------------------------------
-- • RLS izolacija stock_takes / stock_take_items (owner A ≠ owner B)
-- • create_stock_take(): snapshot stavki zalihe
-- • close_stock_take(): vrijednosna razlika + adjustment u inventory_movements + status
-- • period lock: zaključena inventura — stavke se ne mogu mijenjati
-- Pokretanje: supabase test db   (BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(10);

SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-st'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-st');

-- Zalihe tenanta A: Brašno (10 × 2.00), Šećer (5 × 1.00)
INSERT INTO inventory_items (id, restaurant_id, name, category, unit, quantity, cost_per_unit) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Brašno', 'namirnice', 'kg', 10, 2.00),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Šećer',  'namirnice', 'kg', 5,  1.00);

-- Inventura tenanta B (za test izolacije)
INSERT INTO stock_takes (id, restaurant_id, name, status) VALUES
  ('bbbbbbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'B inv', 'open');

-- ── RLS uključen ──
SELECT tests.rls_enabled('public', 'stock_takes');
SELECT tests.rls_enabled('public', 'stock_take_items');

SELECT tests.authenticate_as('owner_a');

-- Vlasnik A ne vidi inventuru tenanta B
SELECT is_empty(
  $$ SELECT 1 FROM stock_takes WHERE id = 'bbbbbbbb-1111-1111-1111-111111111111' $$,
  'Vlasnik A NE vidi inventuru tenanta B'
);

-- WITH CHECK: A ne može kreirati inventuru za tenant B
SELECT throws_ok(
  $$ INSERT INTO stock_takes (restaurant_id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'Ubačeno') $$,
  '42501', NULL,
  'Vlasnik A NE može kreirati inventuru za tenant B'
);

-- create_stock_take snima obje stavke
CREATE TEMP TABLE _st AS
  SELECT public.create_stock_take('11111111-1111-1111-1111-111111111111', 'Test inventura', NULL) AS id;

SELECT results_eq(
  $$ SELECT count(*)::int FROM stock_take_items WHERE stock_take_id = (SELECT id FROM _st) $$,
  ARRAY[2],
  'create_stock_take snima sve stavke zalihe (2)'
);

-- Unos prebrojanog: Brašno 8 (−2 × 2.00 = −4.00), Šećer 7 (+2 × 1.00 = +2.00) → Σ −2.00
UPDATE stock_take_items SET counted_qty = 8
  WHERE stock_take_id = (SELECT id FROM _st) AND item_name = 'Brašno';
UPDATE stock_take_items SET counted_qty = 7
  WHERE stock_take_id = (SELECT id FROM _st) AND item_name = 'Šećer';

-- close vraća ukupnu vrijednosnu razliku −2.00
SELECT results_eq(
  $$ SELECT public.close_stock_take((SELECT id FROM _st)) $$,
  $$ VALUES (-2.00::numeric) $$,
  'close_stock_take vraća vrijednosnu razliku (Σ = −2.00)'
);

-- Stanje Brašna usklađeno na prebrojano (10 → 8)
SELECT results_eq(
  $$ SELECT quantity FROM inventory_items WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ VALUES (8::numeric(10,3)) $$,
  'Zaključenje usklađuje stanje zalihe s prebrojanim (10 → 8)'
);

-- Korekcija upisana u inventory_movements (source stocktake, adjustment)
SELECT isnt_empty(
  $$ SELECT 1 FROM inventory_movements
     WHERE item_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       AND source = 'stocktake' AND type = 'adjustment' $$,
  'Zaključenje knjiži korekciju (source=stocktake, adjustment)'
);

-- Status postaje closed + sačuvana vrijednosna razlika
SELECT results_eq(
  $$ SELECT status, total_diff_value FROM stock_takes WHERE id = (SELECT id FROM _st) $$,
  $$ VALUES ('closed'::text, -2.00::numeric(12,2)) $$,
  'Inventura zaključena, total_diff_value upisan'
);

-- Period lock: stavka zaključene inventure se ne može mijenjati
SELECT throws_ok(
  $$ UPDATE stock_take_items SET counted_qty = 99
     WHERE stock_take_id = (SELECT id FROM _st) AND item_name = 'Šećer' $$,
  'P0001', 'Inventura je zaključena — stavke se ne mogu mijenjati',
  'Period lock blokira izmjenu stavki zaključene inventure'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
