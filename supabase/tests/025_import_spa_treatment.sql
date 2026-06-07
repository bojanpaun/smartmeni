-- ============================================================================
-- import_spa_treatment — uvoz tretmana iz biblioteke + idempotencija + pristup
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('tl_a');
SELECT tests.create_supabase_user('tl_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5454-5454-5454-545454545454', tests.get_supabase_uid('tl_a'), 'TL A', 'tl-a'),
  ('bbbbbbbb-5454-5454-5454-545454545454', tests.get_supabase_uid('tl_b'), 'TL B', 'tl-b');

-- (1) Vlasnik A uvozi 'swedish_massage' iz seed biblioteke → kreira spa_services
SELECT tests.authenticate_as('tl_a');
SELECT public.import_spa_treatment('aaaaaaaa-5454-5454-5454-545454545454', 'swedish_massage');

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT count(*)::int FROM public.spa_services
     WHERE restaurant_id = 'aaaaaaaa-5454-5454-5454-545454545454' AND lower(name) = 'švedska masaža'),
  1,
  'Uvezen tretman "Švedska masaža" u spa_services');

-- (2) Idempotentno: ponovni uvoz → skipped, bez duplikata
SELECT tests.authenticate_as('tl_a');
SELECT is(
  (public.import_spa_treatment('aaaaaaaa-5454-5454-5454-545454545454', 'swedish_massage') ->> 'skipped'),
  'true',
  'Ponovni uvoz istog tretmana je preskočen');

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT count(*)::int FROM public.spa_services
     WHERE restaurant_id = 'aaaaaaaa-5454-5454-5454-545454545454' AND lower(name) = 'švedska masaža'),
  1,
  'Nema duplikata nakon ponovnog uvoza');

-- (3) Vlasnik B ne može uvoziti u A restoran
SELECT tests.authenticate_as('tl_b');
SELECT throws_ok(
  $$ SELECT public.import_spa_treatment('aaaaaaaa-5454-5454-5454-545454545454', 'deep_tissue') $$,
  'Nemate pristup',
  'Vlasnik B ne može uvoziti u restoran A');

SELECT * FROM finish();
ROLLBACK;
