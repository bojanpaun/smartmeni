-- ============================================================================
-- DB test: dashboard_checklist_steps RLS (superadmin piše, svi čitaju) +
-- get_admin_overview v3 nova detekciona polja (menu_items_count/tables_count/
-- staff_count). Šablon: 039 (RLS) + 021 (overview). BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('dc_sa');
SELECT tests.create_supabase_user('dc_obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dc_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dc_obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── RLS: superadmin može INSERT ─────────────────────────────────────────────
SELECT tests.authenticate_as('dc_sa');
SELECT lives_ok(
  $$ INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key)
     VALUES (999, '🧪', 'Test korak', '/admin/test', 'logo') $$,
  'Superadmin može upisati checklist korak'
);

-- ── RLS: običan korisnik NE može INSERT ─────────────────────────────────────
SELECT tests.authenticate_as('dc_obican');
SELECT throws_ok(
  $$ INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path)
     VALUES (998, '🧪', 'Neovlašteni', '/admin/test2') $$,
  '42501',
  NULL,
  'Običan korisnik ne može upisati checklist korak (RLS odbija)'
);

-- ── RLS: prijavljeni čita (seed + test red) ─────────────────────────────────
SELECT cmp_ok(
  (SELECT count(*)::int FROM public.dashboard_checklist_steps),
  '>=', 1,
  'Prijavljeni korisnik čita checklist korake'
);

-- ── get_admin_overview v3: nova polja prisutna (prazan restoran → 0) ─────────
INSERT INTO public.restaurants (id, user_id, name, slug)
VALUES ('cccccccc-7777-7777-7777-777777777777', tests.get_supabase_uid('dc_obican'), 'DC R', 'dc-r');

SELECT tests.authenticate_as('dc_obican');
SELECT is(
  (public.get_admin_overview('cccccccc-7777-7777-7777-777777777777')->>'menu_items_count')::int,
  0, 'get_admin_overview: menu_items_count polje prisutno (0)');
SELECT is(
  (public.get_admin_overview('cccccccc-7777-7777-7777-777777777777')->>'tables_count')::int,
  0, 'get_admin_overview: tables_count polje prisutno (0)');
SELECT is(
  (public.get_admin_overview('cccccccc-7777-7777-7777-777777777777')->>'staff_count')::int,
  0, 'get_admin_overview: staff_count polje prisutno (0)');

SELECT * FROM finish();
ROLLBACK;
