-- ============================================================================
-- import_minibar_items — multi-uvoz iz biblioteke + idempotencija + pristup
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('mbl_a');
SELECT tests.create_supabase_user('mbl_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5555-5555-5555-555555555555', tests.get_supabase_uid('mbl_a'), 'MBL A', 'mbl-a'),
  ('bbbbbbbb-5555-5555-5555-555555555555', tests.get_supabase_uid('mbl_b'), 'MBL B', 'mbl-b');

-- (1) Uvoz 3 artikla iz seed biblioteke
SELECT tests.authenticate_as('mbl_a');
SELECT public.import_minibar_items('aaaaaaaa-5555-5555-5555-555555555555',
  ARRAY['water_still','coca_cola','chips']);

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT count(*)::int FROM public.minibar_items WHERE restaurant_id = 'aaaaaaaa-5555-5555-5555-555555555555'),
  3,
  'Uvezena 3 minibar artikla');

-- (2) Idempotentno: ponovni uvoz istih → skipped, bez duplikata
SELECT tests.authenticate_as('mbl_a');
SELECT is(
  (public.import_minibar_items('aaaaaaaa-5555-5555-5555-555555555555', ARRAY['water_still','coca_cola']) ->> 'skipped'),
  '2',
  'Ponovni uvoz 2 postojeća → skipped = 2');

-- (3) Vlasnik B ne može uvoziti u A
SELECT tests.authenticate_as('mbl_b');
SELECT throws_ok(
  $$ SELECT public.import_minibar_items('aaaaaaaa-5555-5555-5555-555555555555', ARRAY['fanta']) $$,
  'Nemate pristup',
  'Vlasnik B ne može uvoziti u restoran A');

SELECT * FROM finish();
ROLLBACK;
