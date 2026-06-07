-- ============================================================================
-- minibar_items — RLS izolacija (tenant A ne vidi B)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.rls_enabled('public', 'minibar_items');

SELECT tests.create_supabase_user('mb_a');
SELECT tests.create_supabase_user('mb_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5353-5353-5353-535353535353', tests.get_supabase_uid('mb_a'), 'MB A', 'mb-a'),
  ('bbbbbbbb-5353-5353-5353-535353535353', tests.get_supabase_uid('mb_b'), 'MB B', 'mb-b');

INSERT INTO public.minibar_items (restaurant_id, name, price) VALUES
  ('aaaaaaaa-5353-5353-5353-535353535353', 'Coca-Cola', 3);

-- Vlasnik B ne vidi A-ov minibar katalog.
SELECT tests.authenticate_as('mb_b');
SELECT is(
  (SELECT count(*)::int FROM public.minibar_items),
  0,
  'Vlasnik B ne vidi minibar artikle restorana A');

SELECT * FROM finish();
ROLLBACK;
