-- ============================================================================
-- run_night_audit — room charge po noći, idempotencija, izvještaj, authz
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('na_a');
SELECT tests.create_supabase_user('na_b');
INSERT INTO public.restaurants (id, user_id, name, slug, active_verticals) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', tests.get_supabase_uid('na_a'), 'NA A', 'na-a', ARRAY['restaurant','hotel']),
  ('bbbbbbbb-7777-7777-7777-777777777777', tests.get_supabase_uid('na_b'), 'NA B', 'na-b', ARRAY['restaurant']);

-- Soba + checked_in rezervacija (3 noći: 10–13.06), rate 80/noć
INSERT INTO public.rooms (id, restaurant_id, room_number, status)
  VALUES ('11111111-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777', '101', 'occupied');
INSERT INTO public.hotel_reservations
  (id, restaurant_id, room_id, check_in_date, check_out_date, guest_name, rate_per_night, total_amount, status)
  VALUES ('22222222-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777',
          '11111111-7777-7777-7777-777777777777', DATE '2026-06-10', DATE '2026-06-13',
          'Gost Test', 80, 240, 'checked_in');
-- Folio seedovan na 0 (novi model)
INSERT INTO public.folios (id, restaurant_id, reservation_id, status, total_amount)
  VALUES ('33333333-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777',
          '22222222-7777-7777-7777-777777777777', 'open', 0);

-- ── Audit za 10.06 (vlasnik A) ──────────────────────────────────────────────
SELECT tests.authenticate_as('na_a');
SELECT public.run_night_audit('aaaaaaaa-7777-7777-7777-777777777777', DATE '2026-06-10');

SELECT tests.authenticate_as_service_role();
-- (1) Jedna room_charge stavka za 10.06
SELECT is(
  (SELECT COUNT(*)::int FROM public.folio_items
     WHERE folio_id = '33333333-7777-7777-7777-777777777777'
       AND type = 'room_charge' AND date = DATE '2026-06-10'),
  1,
  'Jedna room_charge stavka upisana za 10.06');
-- (2) Folio total = 80 (jedna noć)
SELECT is(
  (SELECT total_amount FROM public.folios WHERE id = '33333333-7777-7777-7777-777777777777'),
  80.00::numeric,
  'Folio total = 80 nakon jedne noći');

-- ── Idempotencija: ponovni audit za 10.06 ne dupla ──────────────────────────
SELECT tests.authenticate_as('na_a');
SELECT public.run_night_audit('aaaaaaaa-7777-7777-7777-777777777777', DATE '2026-06-10');

SELECT tests.authenticate_as_service_role();
-- (3) I dalje samo jedna stavka, total ostaje 80
SELECT is(
  (SELECT COUNT(*)::int FROM public.folio_items
     WHERE folio_id = '33333333-7777-7777-7777-777777777777' AND type = 'room_charge'),
  1,
  'Ponovni audit istog dana ne dodaje duplu stavku');
SELECT is(
  (SELECT total_amount FROM public.folios WHERE id = '33333333-7777-7777-7777-777777777777'),
  80.00::numeric,
  'Folio total ostaje 80 nakon ponovnog audita');

-- ── Audit za 11.06 dodaje drugu noć ─────────────────────────────────────────
SELECT tests.authenticate_as('na_a');
SELECT public.run_night_audit('aaaaaaaa-7777-7777-7777-777777777777', DATE '2026-06-11');

SELECT tests.authenticate_as_service_role();
-- (5) Folio total = 160 (dvije noći)
SELECT is(
  (SELECT total_amount FROM public.folios WHERE id = '33333333-7777-7777-7777-777777777777'),
  160.00::numeric,
  'Folio total = 160 nakon druge noći');

-- (6) Izvještaj snimljen u night_audit_runs sa popunjenosti 100%
SELECT is(
  (SELECT (report->>'occupancy_pct')::numeric FROM public.night_audit_runs
     WHERE restaurant_id = 'aaaaaaaa-7777-7777-7777-777777777777' AND business_date = DATE '2026-06-11'),
  100.0::numeric,
  'Izvještaj 11.06 — popunjenost 100% (1/1 soba)');

-- ── Authz: vlasnik B ne može pokrenuti audit za hotel A ─────────────────────
SELECT tests.authenticate_as('na_b');
SELECT throws_ok(
  $$ SELECT public.run_night_audit('aaaaaaaa-7777-7777-7777-777777777777', DATE '2026-06-12') $$,
  'Nemate pristup',
  'Vlasnik B ne može pokrenuti audit za hotel A');

SELECT * FROM finish();
ROLLBACK;
