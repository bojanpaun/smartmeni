-- ============================================================================
-- DB test: get_admin_overview v5 nove detekcione brojke (roles/recipes/therapists/
-- rate_plans/rental_assets/schedules/table_assignments) + prošireni detect_key CHECK.
-- Prazan restoran A (sve 0) vs popunjen B (roles/recipes vide podatke). BEGIN…ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(10);

SELECT tests.create_supabase_user('dd5_sa');
SELECT tests.create_supabase_user('dd5_owner');
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('dd5_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

-- Prazan A + popunjen B (insert kao superuser PRIJE autentikacije → bez RLS borbe).
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-7777-7777-7777-777777777777', tests.get_supabase_uid('dd5_owner'), 'DD5 A', 'dd5-a'),
  ('dddddddd-6666-6666-6666-666666666666', tests.get_supabase_uid('dd5_owner'), 'DD5 B', 'dd5-b');

INSERT INTO public.roles (restaurant_id, name)
  VALUES ('dddddddd-6666-6666-6666-666666666666', 'Konobar');
INSERT INTO public.menu_items (id, restaurant_id, name, price)
  VALUES ('dddddddd-6666-6666-6666-66660000aaaa', 'dddddddd-6666-6666-6666-666666666666', 'Jelo', 10);
INSERT INTO public.inventory_items (id, restaurant_id, name)
  VALUES ('dddddddd-6666-6666-6666-66660000bbbb', 'dddddddd-6666-6666-6666-666666666666', 'Sastojak');
INSERT INTO public.menu_item_ingredients (menu_item_id, inventory_item_id, quantity)
  VALUES ('dddddddd-6666-6666-6666-66660000aaaa', 'dddddddd-6666-6666-6666-66660000bbbb', 1);

SELECT tests.authenticate_as('dd5_owner');

-- ── Prazan A → nova polja prisutna (0) ──────────────────────────────────────
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'roles_count')::int, 0,
  'overview: roles_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'recipes_count')::int, 0,
  'overview: recipes_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'therapists_count')::int, 0,
  'overview: therapists_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'rate_plans_count')::int, 0,
  'overview: rate_plans_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'rental_assets_count')::int, 0,
  'overview: rental_assets_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'schedules_count')::int, 0,
  'overview: schedules_count prisutno (0)');
SELECT is((public.get_admin_overview('dddddddd-7777-7777-7777-777777777777')->>'table_assignments_count')::int, 0,
  'overview: table_assignments_count prisutno (0)');

-- ── Popunjen B → detektori vide podatke ─────────────────────────────────────
SELECT is((public.get_admin_overview('dddddddd-6666-6666-6666-666666666666')->>'roles_count')::int, 1,
  'overview: roles_count = 1 nakon dodate role');
SELECT is((public.get_admin_overview('dddddddd-6666-6666-6666-666666666666')->>'recipes_count')::int, 1,
  'overview: recipes_count = 1 (preko menu_item_ingredients → menu_items)');

-- ── CHECK: nova detect_key vrijednost dozvoljena ────────────────────────────
SELECT tests.authenticate_as('dd5_sa');
SELECT lives_ok(
  $$ INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key)
     VALUES (995, '🔑', 'Role', '/admin/staff/roles', 'roles') $$,
  'detect_key=roles dozvoljen (v5 prošireni CHECK)'
);

SELECT * FROM finish();
ROLLBACK;
