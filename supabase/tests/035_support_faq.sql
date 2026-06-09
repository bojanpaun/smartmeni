-- ============================================================================
-- support_faq — RLS (authenticated čita objavljene; ne-superadmin ne piše)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('faq_u');

-- Seed: jedno objavljeno, jedno skriveno (service_role)
INSERT INTO support_faq (id, question, answer, is_published) VALUES
  ('aaaaaaaa-fa00-fa00-fa00-fa00fa00fa00', 'Objavljeno pitanje', 'Odgovor', true),
  ('bbbbbbbb-fa00-fa00-fa00-fa00fa00fa00', 'Skriveno pitanje', 'Odgovor', false);

SELECT tests.authenticate_as('faq_u');

-- (1) Authenticated vidi objavljeno
SELECT results_eq(
  $$ SELECT count(*)::int FROM support_faq WHERE id = 'aaaaaaaa-fa00-fa00-fa00-fa00fa00fa00' $$,
  ARRAY[1],
  'Authenticated čita objavljeni FAQ');

-- (2) Authenticated NE vidi skriveno
SELECT is_empty(
  $$ SELECT 1 FROM support_faq WHERE id = 'bbbbbbbb-fa00-fa00-fa00-fa00fa00fa00' $$,
  'Authenticated NE vidi neobjavljeni FAQ');

-- (3) Ne-superadmin ne može dodati FAQ
SELECT throws_ok(
  $$ INSERT INTO support_faq (question, answer) VALUES ('Hak', 'Hak') $$,
  '42501',
  NULL,
  'Ne-superadmin ne može dodati FAQ');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
