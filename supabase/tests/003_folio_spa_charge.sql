-- ============================================================================
-- Sloj 1 — DB test: Folio ispravnost (spa naplata na folio)
-- ----------------------------------------------------------------------------
-- Testira trigger trg_spa_folio → create_spa_folio_item:
--   kad se spa termin (payment_method='folio', status='confirmed', vezan za
--   hotelsku rezervaciju koja ima OTVOREN folio) upiše, automatski se kreira
--   spa folio_item na tom foliju s tačnim iznosom.
--   Termin koji NIJE 'folio' (npr. 'cash') NE smije dodati stavku.
--
-- Računovodstvena ispravnost — kritična oblast.
--
-- Cijeli test radi u BEGIN ... ROLLBACK.  Pokretanje: supabase test db
-- ============================================================================

BEGIN;
-- tests.* helperi: iz 0000_setup_test_helpers.sql (učitava se prvi)

SELECT plan(5);

-- ── Setup ───────────────────────────────────────────────────────────────────
SELECT tests.create_supabase_user('spa_vlasnik');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('44444444-4444-4444-4444-444444444444', tests.get_supabase_uid('spa_vlasnik'), 'Hotel Spa', 'hotel-spa-test');

-- Hotelska rezervacija (minimalne NOT NULL kolone).
INSERT INTO hotel_reservations (id, restaurant_id, check_in_date, check_out_date, guest_name) VALUES
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '2026-10-01', '2026-10-04', 'Gost na foliju');

-- OTVOREN folio za tu rezervaciju (trigger ga traži po reservation_id + status='open').
INSERT INTO folios (id, reservation_id, restaurant_id, status) VALUES
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555',
   '44444444-4444-4444-4444-444444444444', 'open');

-- Spa usluga.
INSERT INTO spa_services (id, restaurant_id, name, price) VALUES
  ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 'Masaža 60min', 80);

-- ── Akcija 1: spa termin NA FOLIO ───────────────────────────────────────────
INSERT INTO spa_appointments (
  restaurant_id, service_id, hotel_reservation_id,
  appointment_date, start_time, end_time, duration_minutes,
  price, payment_method, status
) VALUES (
  '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  '2026-10-02', '14:00', '15:00', 60,
  80, 'folio', 'confirmed'
);

-- Test 1: tačno jedna 'spa' stavka je dodata na folio.
SELECT results_eq(
  $$ SELECT count(*)::int FROM folio_items
     WHERE folio_id = '66666666-6666-6666-6666-666666666666' AND type = 'spa' $$,
  ARRAY[1],
  'Spa termin na folio je kreirao tačno 1 folio stavku'
);

-- Test 2: iznos stavke odgovara cijeni termina.
SELECT results_eq(
  $$ SELECT total_price FROM folio_items
     WHERE folio_id = '66666666-6666-6666-6666-666666666666' AND type = 'spa' $$,
  $$ VALUES (80.00::numeric) $$,
  'Iznos folio stavke (80.00) odgovara cijeni spa termina'
);

-- Test 3: stavka NOSI tenant vezu (restaurant_id) — sprečava tihu NULL-orphan
-- stavku (regr. iz create_spa_folio_item). Bez restaurant_id stavka bi bila
-- nevidljiva vlasniku kroz RLS (vidi Test 5).
SELECT results_eq(
  $$ SELECT restaurant_id FROM folio_items
     WHERE folio_id = '66666666-6666-6666-6666-666666666666' AND type = 'spa' $$,
  $$ VALUES ('44444444-4444-4444-4444-444444444444'::uuid) $$,
  'Spa folio stavka nosi restaurant_id svog tenanta (nije NULL)'
);

-- ── Akcija 2: spa termin koji se plaća GOTOVINOM (ne folio) ──────────────────
INSERT INTO spa_appointments (
  restaurant_id, service_id, hotel_reservation_id,
  appointment_date, start_time, end_time, duration_minutes,
  price, payment_method, status
) VALUES (
  '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  '2026-10-03', '14:00', '15:00', 60,
  80, 'cash', 'confirmed'
);

-- Test 4: gotovinski termin NIJE dodao stavku — i dalje samo 1.
SELECT results_eq(
  $$ SELECT count(*)::int FROM folio_items
     WHERE folio_id = '66666666-6666-6666-6666-666666666666' AND type = 'spa' $$,
  ARRAY[1],
  'Gotovinski spa termin NE dodaje stavku na folio (i dalje 1)'
);

-- ── Test 5: stavka je VIDLJIVA vlasniku kroz RLS ────────────────────────────
-- Dosad smo čitali kao superuser (RLS zaobiđen). Pod RLS-om, stavka s
-- restaurant_id = NULL bi NESTALA (NULL IN (...) = NULL) i count bi bio 0 —
-- pa ovaj test direktno hvata orphan-stavku bug.
SELECT tests.authenticate_as('spa_vlasnik');

SELECT results_eq(
  $$ SELECT count(*)::int FROM folio_items
     WHERE folio_id = '66666666-6666-6666-6666-666666666666' AND type = 'spa' $$,
  ARRAY[1],
  'Vlasnik kroz RLS vidi svoju spa folio stavku (nije orphan/NULL tenant)'
);

SELECT tests.clear_authentication();

SELECT * FROM finish();
ROLLBACK;
