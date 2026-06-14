-- ============================================================================
-- DB test: platform_roadmap RLS — superadmin piše, ne-superadmin ne; svi
-- prijavljeni čitaju aktivne. Šablon: 040. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('rm_sa');
SELECT tests.create_supabase_user('rm_obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('rm_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('rm_obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── Test 1: superadmin može INSERT ──────────────────────────────────────────
SELECT tests.authenticate_as('rm_sa');
SELECT lives_ok(
  $$ INSERT INTO public.platform_roadmap (title, description) VALUES ('Test', 'Opis') $$,
  'Superadmin može dodati roadmap stavku'
);

-- ── Test 2: običan korisnik NE može INSERT (RLS) ────────────────────────────
SELECT tests.authenticate_as('rm_obican');
SELECT throws_ok(
  $$ INSERT INTO public.platform_roadmap (title) VALUES ('Hak') $$,
  '42501', NULL,
  'Običan korisnik ne može dodati roadmap stavku (RLS odbija)'
);

-- ── Test 3: prijavljeni čita aktivne (seed) ─────────────────────────────────
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.platform_roadmap WHERE is_active),
  '>=', 3,
  'Prijavljeni korisnik vidi aktivne roadmap stavke (seed)'
);

-- ── Test 4: običan ne vidi NEAKTIVNE (draft) ────────────────────────────────
-- Superadmin doda neaktivnu; običan je ne smije vidjeti.
SELECT tests.authenticate_as('rm_sa');
INSERT INTO public.platform_roadmap (title, is_active) VALUES ('Draft skrivena', false);
SELECT tests.authenticate_as('rm_obican');
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.platform_roadmap WHERE title='Draft skrivena' $$,
  ARRAY[0],
  'Običan korisnik ne vidi neaktivne (draft) stavke'
);

SELECT * FROM finish();
ROLLBACK;
