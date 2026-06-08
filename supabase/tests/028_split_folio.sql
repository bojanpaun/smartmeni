-- ============================================================================
-- Split folio — create_secondary_folio + move_folio_item (recalc, guardi)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('sf_a');
SELECT tests.create_supabase_user('sf_b');
INSERT INTO public.restaurants (id, user_id, name, slug, active_verticals) VALUES
  ('aaaaaaaa-8888-8888-8888-888888888888', tests.get_supabase_uid('sf_a'), 'SF A', 'sf-a', ARRAY['restaurant','hotel']),
  ('bbbbbbbb-8888-8888-8888-888888888888', tests.get_supabase_uid('sf_b'), 'SF B', 'sf-b', ARRAY['restaurant']);

-- Rezervacija R + primarni folio P sa jednom stavkom (80)
INSERT INTO public.hotel_reservations
  (id, restaurant_id, check_in_date, check_out_date, guest_name, status)
  VALUES ('22222222-8888-8888-8888-888888888888', 'aaaaaaaa-8888-8888-8888-888888888888',
          DATE '2026-06-10', DATE '2026-06-12', 'Gost SF', 'checked_in');
INSERT INTO public.folios (id, restaurant_id, reservation_id, status, total_amount, is_primary)
  VALUES ('33333333-8888-8888-8888-888888888888', 'aaaaaaaa-8888-8888-8888-888888888888',
          '22222222-8888-8888-8888-888888888888', 'open', 80, true);
INSERT INTO public.folio_items (id, folio_id, restaurant_id, type, description, quantity, unit_price, total_price, date)
  VALUES ('44444444-8888-8888-8888-888888888888', '33333333-8888-8888-8888-888888888888',
          'aaaaaaaa-8888-8888-8888-888888888888', 'restaurant', 'Večera', 1, 80, 80, DATE '2026-06-10');

-- ── Kreiranje sekundarnog folija (vlasnik A) ────────────────────────────────
SELECT tests.authenticate_as('sf_a');
SELECT public.create_secondary_folio('22222222-8888-8888-8888-888888888888', 'Firma d.o.o.') AS sec_id \gset

SELECT tests.authenticate_as_service_role();
-- (1) Sekundarni folio kreiran, NIJE primarni
SELECT is(
  (SELECT is_primary FROM public.folios WHERE id = :'sec_id'),
  false,
  'Sekundarni folio nije primarni');
-- (2) Naziv folija
SELECT is(
  (SELECT label FROM public.folios WHERE id = :'sec_id'),
  'Firma d.o.o.',
  'Naziv sekundarnog folija je sačuvan');

-- ── Premještanje stavke P → S (vlasnik A) ───────────────────────────────────
SELECT tests.authenticate_as('sf_a');
SELECT public.move_folio_item('44444444-8888-8888-8888-888888888888', :'sec_id');

SELECT tests.authenticate_as_service_role();
-- (3) Primarni folio P preračunat na 0 (stavka otišla)
SELECT is(
  (SELECT total_amount FROM public.folios WHERE id = '33333333-8888-8888-8888-888888888888'),
  0::numeric,
  'Primarni folio total = 0 nakon premještanja stavke');
-- (4) Sekundarni folio S = 80
SELECT is(
  (SELECT total_amount FROM public.folios WHERE id = :'sec_id'),
  80::numeric,
  'Sekundarni folio total = 80 nakon premještanja');

-- ── Authz: vlasnik B ────────────────────────────────────────────────────────
SELECT tests.authenticate_as('sf_b');
SELECT throws_ok(
  $$ SELECT public.create_secondary_folio('22222222-8888-8888-8888-888888888888', 'Hack') $$,
  'Nemate pristup',
  'Vlasnik B ne može kreirati folio na rezervaciji A');
SELECT throws_ok(
  $$ SELECT public.move_folio_item('44444444-8888-8888-8888-888888888888',
       '33333333-8888-8888-8888-888888888888') $$,
  'Nemate pristup',
  'Vlasnik B ne može premještati stavke hotela A');

-- ── Guard: premještanje izvan iste rezervacije ──────────────────────────────
-- Druga rezervacija R2 + folio P2 u istom hotelu A
SELECT tests.authenticate_as_service_role();
INSERT INTO public.hotel_reservations
  (id, restaurant_id, check_in_date, check_out_date, guest_name, status)
  VALUES ('55555555-8888-8888-8888-888888888888', 'aaaaaaaa-8888-8888-8888-888888888888',
          DATE '2026-06-10', DATE '2026-06-12', 'Gost 2', 'checked_in');
INSERT INTO public.folios (id, restaurant_id, reservation_id, status, total_amount, is_primary)
  VALUES ('66666666-8888-8888-8888-888888888888', 'aaaaaaaa-8888-8888-8888-888888888888',
          '55555555-8888-8888-8888-888888888888', 'open', 0, true);

SELECT tests.authenticate_as('sf_a');
SELECT throws_ok(
  $$ SELECT public.move_folio_item('44444444-8888-8888-8888-888888888888',
       '66666666-8888-8888-8888-888888888888') $$,
  'Stavka se može premjestiti samo unutar iste rezervacije',
  'Premještanje na folio druge rezervacije je odbijeno');

SELECT * FROM finish();
ROLLBACK;
