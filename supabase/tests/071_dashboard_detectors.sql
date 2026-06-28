-- ============================================================================
-- DB test: get_admin_overview v4 nove detekcione brojke + prošireni detect_key
-- CHECK (inventory/suppliers/room_types/categories/spa_services). BEGIN…ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('dd_sa');
SELECT tests.create_supabase_user('dd_owner');
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dd_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.restaurants (id, user_id, name, slug)
VALUES ('dddddddd-8888-8888-8888-888888888888', tests.get_supabase_uid('dd_owner'), 'DD R', 'dd-r');

-- ── Nova polja prisutna (prazan restoran → 0) ───────────────────────────────
SELECT tests.authenticate_as('dd_owner');
SELECT is((public.get_admin_overview('dddddddd-8888-8888-8888-888888888888')->>'inventory_items_count')::int, 0,
  'overview: inventory_items_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-8888-8888-8888-888888888888')->>'suppliers_count')::int, 0,
  'overview: suppliers_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-8888-8888-8888-888888888888')->>'room_types_count')::int, 0,
  'overview: room_types_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-8888-8888-8888-888888888888')->>'categories_count')::int, 0,
  'overview: categories_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-8888-8888-8888-888888888888')->>'spa_services_count')::int, 0,
  'overview: spa_services_count prisutno (0)');

-- ── CHECK: nova detect_key vrijednost dozvoljena, izmišljena odbijena ────────
SELECT tests.authenticate_as('dd_sa');
SELECT lives_ok(
  $$ INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key)
     VALUES (997, '📦', 'Zalihe', '/admin/inventory', 'inventory') $$,
  'detect_key=inventory je dozvoljen (prošireni CHECK)'
);
SELECT throws_ok(
  $$ INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key)
     VALUES (996, '❓', 'Bogus', '/admin/x', 'bogus_detector') $$,
  '23514',
  NULL,
  'Nepoznat detect_key odbijen (CHECK violation)'
);

SELECT * FROM finish();
ROLLBACK;
