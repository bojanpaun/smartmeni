-- ============================================================================
-- Sloj 1 — DB test: Overbooking zaštita (create_booking_direct)
-- ----------------------------------------------------------------------------
-- Zaštita od duplog bukiranja NE živi u triggeru room_availability (on samo
-- clampuje brojač na 0), nego u fn_auto_assign_room: ona traži fizičku sobu
-- tog tipa koja NEMA preklapajuću rezervaciju
--   (check_in_date < p_check_out AND check_out_date > p_check_in,
--    osim cancelled/no_show). Ako je nema, create_booking_direct diže izuzetak.
--
-- Scenario: tip sobe sa TAČNO JEDNOM fizičkom sobom.
--   1) prva rezervacija prolazi
--   2) preklapajuća druga MORA pasti (nema slobodne sobe)
--   3) susjedna (nepreklapajuća) prolazi — ista soba se opet izdaje
--   4) na kraju postoje tačno 2 rezervacije
--
-- Cijeli test radi u BEGIN ... ROLLBACK.  Pokretanje: supabase test db
-- ============================================================================

BEGIN;
-- tests.* helperi: iz 0000_setup_test_helpers.sql (učitava se prvi)

SELECT plan(4);

-- ── Setup ───────────────────────────────────────────────────────────────────
SELECT tests.create_supabase_user('hotelijer');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('33333333-3333-3333-3333-333333333333', tests.get_supabase_uid('hotelijer'), 'Hotel Test', 'hotel-overbook-test');

INSERT INTO room_types (id, restaurant_id, name, base_price) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Standard', 50);

-- TAČNO JEDNA fizička soba ovog tipa.
INSERT INTO rooms (restaurant_id, room_type_id, room_number, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '101', 'available');

-- ── Test 1: prva rezervacija prolazi ────────────────────────────────────────
SELECT lives_ok(
  $$ SELECT create_booking_direct(
       '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       NULL, NULL, '2026-09-01', '2026-09-05', 2, 0,
       'Gost Prvi', 'prvi@test.me', NULL, NULL, 50, 200) $$,
  'Prva rezervacija (jedina soba slobodna) prolazi'
);

-- ── Test 2: preklapajuća druga MORA pasti ───────────────────────────────────
-- 09-03..09-07 se preklapa sa 09-01..09-05 → nema druge sobe → RAISE EXCEPTION (P0001)
SELECT throws_ok(
  $$ SELECT create_booking_direct(
       '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       NULL, NULL, '2026-09-03', '2026-09-07', 2, 0,
       'Gost Drugi', 'drugi@test.me', NULL, NULL, 50, 200) $$,
  'P0001',
  NULL,
  'Preklapajuća rezervacija je ODBIJENA (overbooking spriječen)'
);

-- ── Test 3: susjedna (nepreklapajuća) prolazi ───────────────────────────────
-- 09-05..09-08: check-out prethodne (09-05) == check-in nove → granica se ne broji kao preklapanje
SELECT lives_ok(
  $$ SELECT create_booking_direct(
       '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       NULL, NULL, '2026-09-05', '2026-09-08', 2, 0,
       'Gost Treci', 'treci@test.me', NULL, NULL, 50, 150) $$,
  'Susjedni (back-to-back) period prolazi — ista soba se opet izdaje'
);

-- ── Test 4: tačno 2 rezervacije upisane (preklapajuća nije) ──────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM hotel_reservations
     WHERE restaurant_id = '33333333-3333-3333-3333-333333333333' $$,
  ARRAY[2],
  'Upisane su tačno 2 rezervacije (odbijena se nije snimila)'
);

SELECT * FROM finish();
ROLLBACK;
