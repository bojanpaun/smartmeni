-- ============================================================================
-- Billing/pricing kontrola — platform_settings, plans, is_beta_free()
-- ----------------------------------------------------------------------------
-- Štiti invarijante:
--   • platform_settings i plans imaju RLS.
--   • SAMO superadmin može mijenjati platform_settings (beta prekidač) — običan
--     vlasnik ne može (inače bi tenant sebi uključio besplatne module).
--   • is_beta_free(): false po defaultu; true kad je globalni beta mod ON;
--     true per-addon (beta_free) i kad je globalni OFF.
--   • plans seed integritet (cijene + includes premješteni iz planUtils.js).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(11);

-- ─── Setup: superadmin + običan vlasnik ──────────────────────────────────────
SELECT tests.create_supabase_user('sa_billing');
SELECT tests.create_supabase_user('reg_owner');
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('sa_billing'), true);

-- (1)(2) RLS uključen na novim platform tabelama.
SELECT tests.rls_enabled('public', 'platform_settings');
SELECT tests.rls_enabled('public', 'plans');

-- (3) Default: nijedan beta mod nije aktivan ⇒ addon nije besplatan.
SELECT tests.authenticate_as_service_role();
SELECT is(
  public.is_beta_free('inventory_pro'),
  false,
  'is_beta_free false po defaultu (globalni i per-addon isključeni)');

-- (4) Superadmin uključuje globalni beta mod.
SELECT tests.authenticate_as('sa_billing');
UPDATE public.platform_settings SET beta_free_mode = true WHERE id = true;
SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT beta_free_mode FROM public.platform_settings WHERE id = true),
  true,
  'Superadmin je uključio globalni beta mod');

-- (5) Globalni beta ON ⇒ bilo koji addon je besplatan.
SELECT is(
  public.is_beta_free('bilo_koji_addon'),
  true,
  'Globalni beta mod čini sve addonе besplatnim');

-- Reset globalnog na OFF (za per-addon i RLS provjeru).
SELECT tests.authenticate_as('sa_billing');
UPDATE public.platform_settings SET beta_free_mode = false WHERE id = true;

-- (6) Običan vlasnik NE može mijenjati platform_settings (RLS).
SELECT tests.authenticate_as('reg_owner');
UPDATE public.platform_settings SET beta_free_mode = true WHERE id = true;
SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT beta_free_mode FROM public.platform_settings WHERE id = true),
  false,
  'Ne-superadmin NIJE mogao uključiti beta mod');

-- (7) Per-addon beta_free: radi i kad je globalni OFF; pogađa samo taj addon.
SELECT tests.authenticate_as('sa_billing');
UPDATE public.addon_catalog SET beta_free = true WHERE id = 'hr_pro';
SELECT tests.authenticate_as_service_role();
SELECT is(
  public.is_beta_free('hr_pro'),
  true,
  'Per-addon beta_free čini taj addon besplatnim (globalni OFF)');
SELECT is(
  public.is_beta_free('inventory_pro'),
  false,
  'Per-addon beta_free ne dira druge addonе');

-- (8)(9) plans seed integritet (iz planUtils.js).
SELECT is(
  (SELECT price_monthly::int FROM public.plans WHERE id = 'restaurant'),
  29,
  'plans: Restoran mjesečna cijena = 29 (seed iz PLAN_PRICING)');
SELECT ok(
  'hotel_core' = ANY (SELECT unnest(includes) FROM public.plans WHERE id = 'hotel'),
  'plans: Hotel plan uključuje hotel_core (seed iz PLAN_INCLUDES)');

-- (10) Enterprise = sve (includes NULL).
SELECT is(
  (SELECT includes FROM public.plans WHERE id = 'enterprise'),
  NULL,
  'plans: Enterprise includes = NULL (sve uključeno)');

SELECT * FROM finish();
ROLLBACK;
