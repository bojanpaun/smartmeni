-- ============================================================================
-- DB test: theme_palettes RLS — superadmin piše, ne-superadmin ne.
-- ----------------------------------------------------------------------------
-- Globalna superadmin tabela (custom palete). Provjera: superadmin može
-- INSERT, obični autentifikovani korisnik NE (RLS 42501). Svi čitaju.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(3);

-- ── Setup: jedan superadmin, jedan običan korisnik ──────────────────────────
SELECT tests.create_supabase_user('sa');
SELECT tests.create_supabase_user('obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── Test 1: superadmin može INSERT ──────────────────────────────────────────
SELECT tests.authenticate_as('sa');
SELECT lives_ok(
  $$ INSERT INTO public.theme_palettes (key, name, light, dark)
     VALUES ('custom-test', 'Test', '{"primary":"#123456"}', '{"primary":"#abcdef"}') $$,
  'Superadmin može kreirati paletu'
);

-- ── Test 2: običan korisnik NE može INSERT (RLS) ────────────────────────────
SELECT tests.authenticate_as('obican');
SELECT throws_ok(
  $$ INSERT INTO public.theme_palettes (key, name)
     VALUES ('custom-hack', 'Hack') $$,
  '42501',
  NULL,
  'Običan korisnik ne može kreirati paletu (RLS odbija)'
);

-- ── Test 3: običan korisnik MOŽE čitati ─────────────────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.theme_palettes WHERE key = 'custom-test' $$,
  ARRAY[1],
  'Autentifikovani korisnik čita palete'
);

SELECT * FROM finish();
ROLLBACK;
