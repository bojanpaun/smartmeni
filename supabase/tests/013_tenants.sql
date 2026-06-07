-- ============================================================================
-- 2b · FAZA 1 — testovi za `tenants` (RLS izolacija + backfill integritet)
-- ----------------------------------------------------------------------------
-- tenants nosi account/billing podatke → mora biti privatan (vlasnik/superadmin),
-- NIKAD javno čitljiv, i 1:1 sa restaurants (isti id).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

-- (1) RLS uključen na tenants.
SELECT tests.rls_enabled('public', 'tenants');

-- (4) Backfill integritet: nijedan restoran bez odgovarajućeg tenant-a.
SELECT is(
  (SELECT count(*)::int FROM public.restaurants r
     WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = r.id)),
  0,
  'Svaki restoran ima tenant (1:1 backfill)');

-- Setup za RLS izolaciju (tenants prije restaurants zbog FK restaurants.id→tenants.id).
SELECT tests.create_supabase_user('t_owner_a');
SELECT tests.create_supabase_user('t_owner_b');
INSERT INTO public.tenants (id, user_id) VALUES
  ('aaaaaaaa-9999-9999-9999-999999999999', tests.get_supabase_uid('t_owner_a')),
  ('bbbbbbbb-9999-9999-9999-999999999999', tests.get_supabase_uid('t_owner_b'));
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-9999-9999-9999-999999999999', tests.get_supabase_uid('t_owner_a'), 'Nalog A', 'nalog-a-tn'),
  ('bbbbbbbb-9999-9999-9999-999999999999', tests.get_supabase_uid('t_owner_b'), 'Nalog B', 'nalog-b-tn');

-- (2) Vlasnik A vidi samo svoj nalog (ne B-ov).
SELECT tests.authenticate_as('t_owner_a');
SELECT results_eq(
  $$ SELECT count(*)::int FROM tenants $$,
  ARRAY[1],
  'Vlasnik A vidi tačno svoj 1 nalog (ne B-ov)');

-- (3) A ne može izmijeniti B-ov nalog.
UPDATE tenants SET plan = 'hacked' WHERE id = 'bbbbbbbb-9999-9999-9999-999999999999';
SELECT tests.authenticate_as_service_role();
SELECT isnt(
  (SELECT plan FROM tenants WHERE id = 'bbbbbbbb-9999-9999-9999-999999999999'),
  'hacked',
  'UPDATE vlasnika A NIJE promijenio B-ov nalog');

SELECT * FROM finish();
ROLLBACK;
