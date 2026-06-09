-- ============================================================================
-- post_stay_room_charges — upis svih noći na check-in (idempotentno, authz)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('rc_a');
SELECT tests.create_supabase_user('rc_b');
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-f000-f000-f000-f000f000f000', tests.get_supabase_uid('rc_a'), 'RC A', 'rc-a'),
  ('bbbbbbbb-f000-f000-f000-f000f000f000', tests.get_supabase_uid('rc_b'), 'RC B', 'rc-b');

-- Rezervacija: 3 noći (10–13.06), rate 80
INSERT INTO hotel_reservations
  (id, restaurant_id, check_in_date, check_out_date, guest_name, rate_per_night, total_amount, status)
  VALUES ('22222222-f000-f000-f000-f000f000f000', 'aaaaaaaa-f000-f000-f000-f000f000f000',
          DATE '2026-06-10', DATE '2026-06-13', 'Gost RC', 80, 240, 'checked_in');

-- Vlasnik A upiše noći
SELECT tests.authenticate_as('rc_a');
SELECT public.post_stay_room_charges('22222222-f000-f000-f000-f000f000f000');

SELECT tests.authenticate_as_service_role();
-- (1) Tri room_charge stavke (3 noći)
SELECT results_eq(
  $$ SELECT count(*)::int FROM folio_items fi
       JOIN folios f ON f.id = fi.folio_id
      WHERE f.reservation_id = '22222222-f000-f000-f000-f000f000f000' AND fi.type = 'room_charge' $$,
  ARRAY[3],
  'Upisane 3 room_charge stavke za 3 noći');
-- (2) Folio total = 240
SELECT results_eq(
  $$ SELECT total_amount FROM folios WHERE reservation_id = '22222222-f000-f000-f000-f000f000f000' $$,
  $$ VALUES (240.00::numeric) $$,
  'Folio total = 240 (3 × 80)');

-- (3) Idempotentno: ponovni poziv ne dodaje duple
SELECT tests.authenticate_as('rc_a');
SELECT public.post_stay_room_charges('22222222-f000-f000-f000-f000f000f000');
SELECT tests.authenticate_as_service_role();
SELECT results_eq(
  $$ SELECT count(*)::int FROM folio_items fi
       JOIN folios f ON f.id = fi.folio_id
      WHERE f.reservation_id = '22222222-f000-f000-f000-f000f000f000' AND fi.type = 'room_charge' $$,
  ARRAY[3],
  'Ponovni poziv ne dodaje duple stavke');

-- (4) Vlasnik B nema pristup
SELECT tests.authenticate_as('rc_b');
SELECT throws_ok(
  $$ SELECT public.post_stay_room_charges('22222222-f000-f000-f000-f000f000f000') $$,
  'Nemate pristup',
  'Vlasnik B ne može upisivati noći na rezervaciju A');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
