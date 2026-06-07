-- ============================================================================
-- Sloj 1 — RLS IZOLACIONA MATRICA (sigurnosna mreža za tenant refaktor / 2b)
-- ----------------------------------------------------------------------------
-- Provjerava NAJVAŽNIJI invariant: tenant A ne smije VIDJETI ni MIJENJATI
-- podatke tenanta B. Pokriva obje vertikale (restoran + hotel), dijeljene
-- tabele i billing. Ovaj test je referentni "before/after" za migraciju na
-- tenants/properties — ako ostane zelen poslije refaktora, izolacija je očuvana.
--
-- NIJANSA (zašto nije generički/dinamički test):
--   • PRIVATNE tabele (guests, staff, roles, order_items, subscriptions,
--     hotel_reservations) → SELECT izolacija VAŽI (A vidi 0 redova tenanta B).
--   • JAVNO ČITLJIVE tabele (categories, menu_items vidljive, orders) →
--     SELECT izolacija NE važi po dizajnu (guest meni/tracking). Za njih
--     testiramo WRITE izolaciju (A ne može INSERT/UPDATE/DELETE tuđe).
--   WRITE izolacija važi UNIVERZALNO i to je glavni štit od cross-tenant izmjena.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(11);

-- ── Setup (postgres → RLS se zaobilazi pri seedovanju) ──────────────────────
SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-rls'),
  ('bbbbbbbb-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-rls');

-- Po jedan red tenanta B u svakoj testiranoj tabeli (minimalne NOT NULL kolone).
INSERT INTO categories        (restaurant_id, name)                       VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Kat B');
INSERT INTO menu_items        (restaurant_id, name, price)                VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Jelo B', 5);
INSERT INTO order_items       (restaurant_id, name, price)                VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Stavka B', 5);
INSERT INTO guests            (restaurant_id, first_name)                 VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Gost B');
INSERT INTO staff             (restaurant_id, email)                      VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'b@staff.test');
INSERT INTO roles             (restaurant_id, name)                       VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Konobar B');
INSERT INTO subscriptions     (restaurant_id)                             VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO hotel_reservations(restaurant_id, check_in_date, check_out_date, guest_name)
  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', '2026-07-01', '2026-07-03', 'Gost B');

-- ── Ulogovan kao vlasnik A ──────────────────────────────────────────────────
SELECT tests.authenticate_as('owner_a');

-- SELECT izolacija (privatne tabele): A vidi 0 redova tenanta B.
SELECT results_eq($$ SELECT count(*)::int FROM order_items        $$, ARRAY[0], 'order_items: A ne vidi B');
SELECT results_eq($$ SELECT count(*)::int FROM guests             $$, ARRAY[0], 'guests: A ne vidi B');
SELECT results_eq($$ SELECT count(*)::int FROM staff              $$, ARRAY[0], 'staff: A ne vidi B');
SELECT results_eq($$ SELECT count(*)::int FROM roles              $$, ARRAY[0], 'roles: A ne vidi B');
SELECT results_eq($$ SELECT count(*)::int FROM subscriptions      $$, ARRAY[0], 'subscriptions: A ne vidi B');
SELECT results_eq($$ SELECT count(*)::int FROM hotel_reservations $$, ARRAY[0], 'hotel_reservations: A ne vidi B');

-- WRITE izolacija — INSERT s tuđim restaurant_id mora biti odbijen (RLS WITH CHECK, 42501).
SELECT throws_ok(
  $$ INSERT INTO guests (restaurant_id, first_name) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Ubaceni') $$,
  '42501', NULL, 'guests: A ne može INSERT u tenanta B');
SELECT throws_ok(
  $$ INSERT INTO menu_items (restaurant_id, name, price) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Ubaceno', 1) $$,
  '42501', NULL, 'menu_items: A ne može INSERT u tenanta B');
SELECT throws_ok(
  $$ INSERT INTO categories (restaurant_id, name) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Ubacena') $$,
  '42501', NULL, 'categories: A ne može INSERT u tenanta B');

-- WRITE izolacija — UPDATE/DELETE tuđih redova ne smije imati efekta.
UPDATE guests SET first_name = 'HAKOVANO' WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM hotel_reservations WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';

-- ── Provjera kao service_role (zaobilazi RLS) — red tenanta B netaknut ───────
SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT first_name FROM guests WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'),
  'Gost B',
  'guests: UPDATE tenanta A NIJE promijenio red tenanta B');
SELECT is(
  (SELECT count(*)::int FROM hotel_reservations WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'),
  1,
  'hotel_reservations: DELETE tenanta A NIJE obrisao red tenanta B');

SELECT * FROM finish();
ROLLBACK;
