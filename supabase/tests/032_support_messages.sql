-- ============================================================================
-- Support threadovi — RLS izolacija (tenant ne vidi/piše tuđe; owner samo 'admin')
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('su_a');
SELECT tests.create_supabase_user('su_b');
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-c000-c000-c000-c000c000c000', tests.get_supabase_uid('su_a'), 'SU A', 'su-a'),
  ('bbbbbbbb-c000-c000-c000-c000c000c000', tests.get_supabase_uid('su_b'), 'SU B', 'su-b');

-- Konverzacija + poruka tenanta A (seed kao service_role)
INSERT INTO support_conversations (id, restaurant_id, subject)
  VALUES ('cccccccc-c000-c000-c000-c000c000c000', 'aaaaaaaa-c000-c000-c000-c000c000c000', 'Pitanje A');
INSERT INTO support_messages (conversation_id, restaurant_id, sender_role, body)
  VALUES ('cccccccc-c000-c000-c000-c000c000c000', 'aaaaaaaa-c000-c000-c000-c000c000c000', 'admin', 'Prva poruka');

-- (1) Vlasnik A vidi svoju konverzaciju
SELECT tests.authenticate_as('su_a');
SELECT results_eq(
  $$ SELECT count(*)::int FROM support_conversations WHERE id = 'cccccccc-c000-c000-c000-c000c000c000' $$,
  ARRAY[1],
  'Vlasnik A vidi svoju konverzaciju');

-- (2) Vlasnik A može poslati 'admin' poruku u svoju konverzaciju
SELECT lives_ok(
  $$ INSERT INTO support_messages (conversation_id, restaurant_id, sender_role, body)
     VALUES ('cccccccc-c000-c000-c000-c000c000c000', 'aaaaaaaa-c000-c000-c000-c000c000c000', 'admin', 'Druga') $$,
  'Vlasnik A šalje admin poruku u svoju konverzaciju');

-- (3) Vlasnik A NE može slati kao 'superadmin'
SELECT throws_ok(
  $$ INSERT INTO support_messages (conversation_id, restaurant_id, sender_role, body)
     VALUES ('cccccccc-c000-c000-c000-c000c000c000', 'aaaaaaaa-c000-c000-c000-c000c000c000', 'superadmin', 'Lažno') $$,
  '42501',
  NULL,
  'Vlasnik ne može slati kao superadmin');

-- (4) Vlasnik B NE vidi tuđu konverzaciju
SELECT tests.authenticate_as('su_b');
SELECT is_empty(
  $$ SELECT 1 FROM support_conversations WHERE id = 'cccccccc-c000-c000-c000-c000c000c000' $$,
  'Vlasnik B ne vidi konverzaciju tenanta A');

-- (5) Vlasnik B NE može pisati u tuđu konverzaciju
SELECT throws_ok(
  $$ INSERT INTO support_messages (conversation_id, restaurant_id, sender_role, body)
     VALUES ('cccccccc-c000-c000-c000-c000c000c000', 'aaaaaaaa-c000-c000-c000-c000c000c000', 'admin', 'Upad') $$,
  '42501',
  NULL,
  'Vlasnik B ne može pisati u konverzaciju tenanta A');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
