-- ============================================================================
-- Platform najave — RLS (authenticated čita, ne-superadmin ne piše; reads own-only)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('an_a');
SELECT tests.create_supabase_user('an_b');

-- Seed najave kao service_role (superadmin write path se ne testira ovdje)
INSERT INTO platform_announcements (id, title, body, severity, audience)
  VALUES ('aaaaaaaa-a000-a000-a000-a000a000a000', 'Test najava', 'Tijelo', 'info', 'all');

-- (1) Authenticated korisnik čita najavu (read policy USING true za authenticated)
SELECT tests.authenticate_as('an_a');
SELECT results_eq(
  $$ SELECT count(*)::int FROM platform_announcements WHERE id = 'aaaaaaaa-a000-a000-a000-a000a000a000' $$,
  ARRAY[1],
  'Authenticated admin čita platform najavu');

-- (2) Ne-superadmin NE može objaviti najavu (WITH CHECK is_superadmin())
SELECT throws_ok(
  $$ INSERT INTO platform_announcements (title) VALUES ('Hak') $$,
  '42501',
  NULL,
  'Ne-superadmin ne može objaviti najavu (samo superadmin)');

-- (3) Korisnik upisuje svoj 'pročitano' zapis
SELECT lives_ok(
  $$ INSERT INTO announcement_reads (announcement_id, user_id)
     VALUES ('aaaaaaaa-a000-a000-a000-a000a000a000', tests.get_supabase_uid('an_a')) $$,
  'Korisnik upisuje svoj read zapis');

-- (4) Drugi korisnik NE vidi tuđi read (own-only RLS)
SELECT tests.authenticate_as('an_b');
SELECT is_empty(
  $$ SELECT 1 FROM announcement_reads WHERE announcement_id = 'aaaaaaaa-a000-a000-a000-a000a000a000' $$,
  'Korisnik B ne vidi read zapis korisnika A');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
