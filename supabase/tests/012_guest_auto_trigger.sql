-- ============================================================================
-- Sloj 1 — KRITIČNI TOK: auto-kreiranje gosta iz rezervacije (baseline za 2b)
-- ----------------------------------------------------------------------------
-- trg_fn_auto_create_guest (SECURITY DEFINER): kad rezervacija ima guest_email,
-- nađe-ili-kreira gosta za isti restaurant_id i postavi reservation.guest_id.
-- Phase 1 (tenants) dira RLS/veze na guests — ovaj test je referentni before/after.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('owner_g');
INSERT INTO restaurants (id, user_id, name, slug)
VALUES ('cccccccc-3333-3333-3333-333333333333', tests.get_supabase_uid('owner_g'), 'Hotel G', 'hotel-g-trg');

-- Rezervacija s guest_email → trigger treba kreirati gosta i povezati guest_id.
INSERT INTO hotel_reservations (restaurant_id, check_in_date, check_out_date, guest_name, guest_email, guest_phone)
VALUES ('cccccccc-3333-3333-3333-333333333333', '2026-08-01', '2026-08-03', 'Marko Marković', 'marko@test.me', '069111222');

SELECT is(
  (SELECT count(*)::int FROM guests WHERE restaurant_id = 'cccccccc-3333-3333-3333-333333333333' AND email = 'marko@test.me'),
  1,
  'Auto-trigger je kreirao tačno jednog gosta za rezervaciju s emailom');

SELECT is(
  (SELECT first_name FROM guests WHERE restaurant_id = 'cccccccc-3333-3333-3333-333333333333' AND email = 'marko@test.me'),
  'Marko',
  'Gost ima ispravno razdvojeno ime (first_name)');

SELECT ok(
  (SELECT guest_id FROM hotel_reservations WHERE restaurant_id = 'cccccccc-3333-3333-3333-333333333333') IS NOT NULL,
  'Rezervacija je povezana s gostom (guest_id postavljen)');

SELECT * FROM finish();
ROLLBACK;
