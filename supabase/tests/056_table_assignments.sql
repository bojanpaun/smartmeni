-- ============================================================================
-- DB test: table_assignments — RLS izolacija (owner A/B), unique (table_id,date),
-- konobar vidi SAMO svoje dodjele. BEGIN…ROLLBACK.
-- UUID prostor dddddddd-7227-… (provjereno: slobodan, ne preklapa se sa seed/testovima).
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('asg_a');   -- vlasnik A
SELECT tests.create_supabase_user('asg_b');   -- vlasnik B
SELECT tests.create_supabase_user('asg_s');   -- konobar (staff) u A

-- Setup kao superuser (zaobilazi RLS) — restorani, osoblje, layout, stolovi, dodjele.
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-7227-7227-7227-72277227a001', tests.get_supabase_uid('asg_a'), 'Asg A', 'asg-a'),
  ('dddddddd-7227-7227-7227-72277227b001', tests.get_supabase_uid('asg_b'), 'Asg B', 'asg-b');

INSERT INTO staff (id, restaurant_id, user_id, email) VALUES
  ('dddddddd-7227-7227-7227-72277227a501', 'dddddddd-7227-7227-7227-72277227a001', tests.get_supabase_uid('asg_s'), 's@asg-a.test'),
  ('dddddddd-7227-7227-7227-72277227a502', 'dddddddd-7227-7227-7227-72277227a001', NULL,                            's2@asg-a.test');

INSERT INTO table_layouts (id, restaurant_id, name, is_active) VALUES
  ('dddddddd-7227-7227-7227-72277227a101', 'dddddddd-7227-7227-7227-72277227a001', 'Standardni', true);

INSERT INTO tables (id, restaurant_id, layout_id, number, seats) VALUES
  ('dddddddd-7227-7227-7227-72277227a201', 'dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a101', 1, 4),
  ('dddddddd-7227-7227-7227-72277227a202', 'dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a101', 2, 4);

INSERT INTO table_assignments (restaurant_id, table_id, staff_id, date) VALUES
  ('dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a201', 'dddddddd-7227-7227-7227-72277227a501', '2026-07-01'),
  ('dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a202', 'dddddddd-7227-7227-7227-72277227a502', '2026-07-01');

-- (1) unique (table_id, date): druga dodjela istog stola istog dana → 23505
SELECT tests.authenticate_as('asg_a');
SELECT throws_ok(
  $$ INSERT INTO table_assignments (restaurant_id, table_id, staff_id, date)
     VALUES ('dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a201',
             'dddddddd-7227-7227-7227-72277227a502', '2026-07-01') $$,
  '23505', NULL, 'unique (table_id, date) odbija dvije dodjele istog stola istog dana');

-- (2) RLS SELECT: vlasnik B ne vidi A-jeve dodjele
SELECT tests.authenticate_as('asg_b');
SELECT is_empty(
  $$ SELECT 1 FROM table_assignments WHERE restaurant_id = 'dddddddd-7227-7227-7227-72277227a001' $$,
  'Vlasnik B ne vidi dodjele tenanta A');

-- (3) RLS WITH CHECK: B ne može upisati dodjelu u A → 42501
SELECT throws_ok(
  $$ INSERT INTO table_assignments (restaurant_id, table_id, staff_id, date)
     VALUES ('dddddddd-7227-7227-7227-72277227a001', 'dddddddd-7227-7227-7227-72277227a201',
             'dddddddd-7227-7227-7227-72277227a501', '2026-07-02') $$,
  '42501', NULL, 'Vlasnik B ne može upisati dodjelu u tuđi restoran');

-- (4) Konobar S vidi SVOJU dodjelu (sto a201)
SELECT tests.authenticate_as('asg_s');
SELECT is(
  (SELECT count(*)::int FROM table_assignments WHERE table_id = 'dddddddd-7227-7227-7227-72277227a201'),
  1, 'Konobar vidi svoju dodjelu');

-- (5) Konobar S NE vidi tuđu dodjelu (sto a202 → konobar S2)
SELECT is(
  (SELECT count(*)::int FROM table_assignments WHERE table_id = 'dddddddd-7227-7227-7227-72277227a202'),
  0, 'Konobar ne vidi tuđu dodjelu');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
