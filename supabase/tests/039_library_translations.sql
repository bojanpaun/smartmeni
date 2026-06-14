-- ============================================================================
-- DB test: library_translations RLS — superadmin piše, ne-superadmin ne; svi
-- prijavljeni čitaju (Faza 4 — prevod globalnih biblioteka). Šablon: 036.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('lib_sa');
SELECT tests.create_supabase_user('lib_obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('lib_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('lib_obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── Test 1: superadmin može INSERT ──────────────────────────────────────────
SELECT tests.authenticate_as('lib_sa');
SELECT lives_ok(
  $$ INSERT INTO public.library_translations (entity_type, entity_id, field, lang, value)
     VALUES ('recipe_library', 'aaaaaaaa-9999-9999-9999-999999999999', 'name', 'en', 'Espresso') $$,
  'Superadmin može upisati prevod biblioteke'
);

-- ── Test 2: običan korisnik NE može INSERT (RLS) ────────────────────────────
SELECT tests.authenticate_as('lib_obican');
SELECT throws_ok(
  $$ INSERT INTO public.library_translations (entity_type, entity_id, field, lang, value)
     VALUES ('recipe_library', 'bbbbbbbb-9999-9999-9999-999999999999', 'name', 'sr', 'Hak') $$,
  '42501',
  NULL,
  'Običan korisnik ne može upisati prevod biblioteke (RLS odbija)'
);

-- ── Test 3: prijavljeni korisnik MOŽE čitati (picker) ───────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.library_translations
     WHERE entity_id = 'aaaaaaaa-9999-9999-9999-999999999999' $$,
  ARRAY[1],
  'Prijavljeni korisnik čita prevode biblioteka (picker)'
);

SELECT * FROM finish();
ROLLBACK;
