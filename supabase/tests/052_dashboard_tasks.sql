-- ============================================================================
-- DB test: dashboard_tasks RLS — superadmin piše, ne-superadmin ne; svi prijavljeni
-- čitaju (konfigurabilna task traka admin početne). Globalna tabela (bez
-- restaurant_id), pa nije tenant-izolacija nego superadmin-write. Šablon: 039.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('dt_sa');
SELECT tests.create_supabase_user('dt_obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dt_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dt_obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── Test 1: superadmin može INSERT ──────────────────────────────────────────
SELECT tests.authenticate_as('dt_sa');
SELECT lives_ok(
  $$ INSERT INTO public.dashboard_tasks (sort_order, icon, label, path)
     VALUES (999, '🧪', 'Test zadatak', '/admin/test') $$,
  'Superadmin može upisati dashboard zadatak'
);

-- ── Test 2: običan korisnik NE može INSERT (RLS) ────────────────────────────
SELECT tests.authenticate_as('dt_obican');
SELECT throws_ok(
  $$ INSERT INTO public.dashboard_tasks (sort_order, icon, label, path)
     VALUES (998, '🧪', 'Neovlašteni', '/admin/test2') $$,
  '42501',
  NULL,
  'Običan korisnik ne može upisati dashboard zadatak (RLS odbija)'
);

-- ── Test 3: prijavljeni korisnik MOŽE čitati (task traka) ───────────────────
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.dashboard_tasks),
  '>=', 1,
  'Prijavljeni korisnik čita dashboard zadatke (task traka)'
);

SELECT * FROM finish();
ROLLBACK;
