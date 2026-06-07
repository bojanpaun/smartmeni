-- ============================================================================
-- get_admin_overview() — tačnost brojki + pristup (tenant izolacija)
-- ----------------------------------------------------------------------------
-- Jedan RPC vraća sve /admin dashboard brojke. Vlasnik dobija svoje; tuđe ne
-- može (RAISE EXCEPTION).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('ov_a');
SELECT tests.create_supabase_user('ov_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-6666-6666-6666-666666666666', tests.get_supabase_uid('ov_a'), 'OV A', 'ov-a'),
  ('bbbbbbbb-6666-6666-6666-666666666666', tests.get_supabase_uid('ov_b'), 'OV B', 'ov-b');

-- 2 narudžbe (status 'received' → broji se u "waiter") + 1 nerješen zahtjev konobaru.
INSERT INTO public.orders (restaurant_id, table_number, status) VALUES
  ('aaaaaaaa-6666-6666-6666-666666666666', '1', 'received'),
  ('aaaaaaaa-6666-6666-6666-666666666666', '2', 'received');
INSERT INTO public.waiter_requests (restaurant_id, table_number, request_type) VALUES
  ('aaaaaaaa-6666-6666-6666-666666666666', '1', 'call');

-- (1)(2) Vlasnik A dobija svoje brojke.
SELECT tests.authenticate_as('ov_a');
SELECT is(
  (public.get_admin_overview('aaaaaaaa-6666-6666-6666-666666666666')->>'waiter')::int,
  2,
  'get_admin_overview: waiter = 2 (dvije received narudžbe)');
SELECT is(
  (public.get_admin_overview('aaaaaaaa-6666-6666-6666-666666666666')->>'waiter_req')::int,
  1,
  'get_admin_overview: waiter_req = 1 (jedan nerješen zahtjev)');

-- (3) Vlasnik B ne može dobiti A-ove brojke.
SELECT tests.authenticate_as('ov_b');
SELECT throws_ok(
  $$ SELECT public.get_admin_overview('aaaaaaaa-6666-6666-6666-666666666666') $$,
  'Nemate pristup ovom restoranu',
  'get_admin_overview: tuđi restoran → odbijen pristup');

SELECT * FROM finish();
ROLLBACK;
