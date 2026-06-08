-- ============================================================================
-- RLS izolacija na breakfast_log (Faza N — doručak kontrola)
-- ----------------------------------------------------------------------------
-- Tenant A ne vidi i ne može pisati breakfast_log tenanta B. Šablon: 001.
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('bf_a');
SELECT tests.create_supabase_user('bf_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-9999-9999-9999-999999999999', tests.get_supabase_uid('bf_a'), 'BF A', 'bf-a'),
  ('bbbbbbbb-9999-9999-9999-999999999999', tests.get_supabase_uid('bf_b'), 'BF B', 'bf-b');

INSERT INTO hotel_reservations (id, restaurant_id, check_in_date, check_out_date, guest_name) VALUES
  ('a1a1a1a1-9999-9999-9999-999999999999', 'aaaaaaaa-9999-9999-9999-999999999999', '2026-07-01', '2026-07-03', 'Gost A'),
  ('b1b1b1b1-9999-9999-9999-999999999999', 'bbbbbbbb-9999-9999-9999-999999999999', '2026-07-01', '2026-07-03', 'Gost B');

-- Seed: po jedan breakfast_log u svakom tenantu
INSERT INTO breakfast_log (restaurant_id, reservation_id, date, persons) VALUES
  ('aaaaaaaa-9999-9999-9999-999999999999', 'a1a1a1a1-9999-9999-9999-999999999999', '2026-07-01', 2),
  ('bbbbbbbb-9999-9999-9999-999999999999', 'b1b1b1b1-9999-9999-9999-999999999999', '2026-07-01', 1);

-- (0) RLS uključen
SELECT tests.rls_enabled('public', 'breakfast_log');

SELECT tests.authenticate_as('bf_a');

-- (1) Vlasnik A vidi tačno svoj 1 zapis
SELECT results_eq(
  'SELECT count(*)::int FROM breakfast_log',
  ARRAY[1],
  'Vlasnik A vidi tačno svoj 1 breakfast_log');

-- (2) Ne vidi tuđi zapis ni eksplicitnim filterom
SELECT is_empty(
  $$ SELECT 1 FROM breakfast_log WHERE restaurant_id = 'bbbbbbbb-9999-9999-9999-999999999999' $$,
  'Vlasnik A NE vidi breakfast_log tenanta B');

-- (3) Ne može pisati u tuđi tenant
SELECT throws_ok(
  $$ INSERT INTO breakfast_log (restaurant_id, reservation_id, date, persons)
     VALUES ('bbbbbbbb-9999-9999-9999-999999999999', 'b1b1b1b1-9999-9999-9999-999999999999', '2026-07-02', 1) $$,
  '42501',
  NULL,
  'Vlasnik A NE može pisati breakfast_log u tenant B');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
