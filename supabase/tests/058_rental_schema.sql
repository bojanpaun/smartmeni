-- ============================================================================
-- DB test: rental šema (RENT-0 temelj) — EXCLUDE overbooking guard, RLS izolacija
-- (owner A/B), auto-guest trigger na rental_bookings. BEGIN…ROLLBACK.
-- UUID prostor dddddddd-8228-… (provjereno: slobodan, ne preklapa se sa seed/testovima).
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('rnt_a');   -- vlasnik A
SELECT tests.create_supabase_user('rnt_b');   -- vlasnik B

-- Setup kao superuser (zaobilazi RLS).
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-8228-8228-8228-82288228a001', tests.get_supabase_uid('rnt_a'), 'Rent A', 'rent-a'),
  ('dddddddd-8228-8228-8228-82288228b001', tests.get_supabase_uid('rnt_b'), 'Rent B', 'rent-b');

INSERT INTO rental_assets (id, restaurant_id, name) VALUES
  ('dddddddd-8228-8228-8228-82288228a201', 'dddddddd-8228-8228-8228-82288228a001', 'Vila Galeb');

-- Bazna rezervacija (bez e-maila → customer_id ostaje NULL), 10–15 jul.
INSERT INTO rental_bookings (id, restaurant_id, asset_id, start_date, end_date, guest_name) VALUES
  ('dddddddd-8228-8228-8228-82288228a301', 'dddddddd-8228-8228-8228-82288228a001',
   'dddddddd-8228-8228-8228-82288228a201', '2026-07-10', '2026-07-15', 'Bazni gost');

-- (1) EXCLUDE: preklapanje datuma istog sredstva → 23P01 (exclusion_violation)
SELECT tests.authenticate_as('rnt_a');
SELECT throws_ok(
  $$ INSERT INTO rental_bookings (restaurant_id, asset_id, start_date, end_date, guest_name)
     VALUES ('dddddddd-8228-8228-8228-82288228a001', 'dddddddd-8228-8228-8228-82288228a201',
             '2026-07-12', '2026-07-14', 'Preklapanje') $$,
  '23P01', NULL, 'EXCLUDE odbija preklapajuću rezervaciju istog sredstva');

-- (2) EXCLUDE: nadovezivanje (checkout = checkin, half-open '[)') → dozvoljeno
SELECT lives_ok(
  $$ INSERT INTO rental_bookings (restaurant_id, asset_id, start_date, end_date, guest_name)
     VALUES ('dddddddd-8228-8228-8228-82288228a001', 'dddddddd-8228-8228-8228-82288228a201',
             '2026-07-15', '2026-07-18', 'Nadovezan') $$,
  'EXCLUDE dozvoljava nadovezivanje (checkout = sljedeći checkin)');

-- (3) RLS SELECT: vlasnik B ne vidi A-jeve rezervacije
SELECT tests.authenticate_as('rnt_b');
SELECT is_empty(
  $$ SELECT 1 FROM rental_bookings WHERE restaurant_id = 'dddddddd-8228-8228-8228-82288228a001' $$,
  'Vlasnik B ne vidi rezervacije tenanta A');

-- (4) RLS WITH CHECK: B ne može upisati rezervaciju u A → 42501
SELECT throws_ok(
  $$ INSERT INTO rental_bookings (restaurant_id, asset_id, start_date, end_date, guest_name)
     VALUES ('dddddddd-8228-8228-8228-82288228a001', 'dddddddd-8228-8228-8228-82288228a201',
             '2026-09-01', '2026-09-05', 'Tuđa') $$,
  '42501', NULL, 'Vlasnik B ne može upisati rezervaciju u tuđi restoran');

-- (5)+(6) Auto-guest trigger: rezervacija sa e-mailom → customer_id popunjen + guest kreiran
SELECT tests.authenticate_as('rnt_a');
INSERT INTO rental_bookings (id, restaurant_id, asset_id, start_date, end_date, guest_name, guest_email, guest_phone)
VALUES ('dddddddd-8228-8228-8228-82288228a302', 'dddddddd-8228-8228-8228-82288228a001',
        'dddddddd-8228-8228-8228-82288228a201', '2026-08-01', '2026-08-05',
        'Marko Marković', 'marko@primjer.me', '+38269000000');

SELECT isnt(
  (SELECT customer_id FROM rental_bookings WHERE id = 'dddddddd-8228-8228-8228-82288228a302'),
  NULL, 'Auto-guest: customer_id je popunjen nakon inserta sa e-mailom');

SELECT is(
  (SELECT count(*)::int FROM guests
     WHERE restaurant_id = 'dddddddd-8228-8228-8228-82288228a001' AND lower(email) = 'marko@primjer.me'),
  1, 'Auto-guest: gost je kreiran u CRM (guests) iz rezervacije');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
