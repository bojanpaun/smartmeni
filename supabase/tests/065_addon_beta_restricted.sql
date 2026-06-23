-- ============================================================================
-- Beta izuzetak po modulu — addon_catalog.beta_restricted + is_beta_free()
-- ----------------------------------------------------------------------------
-- Štiti invarijantu: globalni beta mod otključava SVE module OSIM onih označenih
-- beta_restricted. Restriktivan modul ostaje zatvoren (vide ga samo tenanti s
-- eksplicitnim grantom kroz subscriptions.addons / hasAddon), osim ako per-addon
-- beta_free nije true (eksplicitno besplatno svima — ima prednost nad restrikcijom).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(5);

-- ─── Setup: superadmin ───────────────────────────────────────────────────────
SELECT tests.create_supabase_user('sa_restr');
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('sa_restr'), true);

-- (1) Default: novi flag je false.
SELECT is(
  (SELECT beta_restricted FROM public.addon_catalog WHERE id = 'hotel_core'),
  false,
  'beta_restricted false po defaultu');

-- Superadmin: globalni beta ON + označi hotel_core kao restriktivan.
SELECT tests.authenticate_as('sa_restr');
UPDATE public.platform_settings SET beta_free_mode = true WHERE id = true;
UPDATE public.addon_catalog SET beta_restricted = true, beta_free = false WHERE id = 'hotel_core';
SELECT tests.authenticate_as_service_role();

-- (2) Globalni beta ON, modul NIJE restriktivan ⇒ besplatan (kontrola).
SELECT is(
  public.is_beta_free('inventory_pro'),
  true,
  'Globalni beta otključava modul koji nije restriktivan');

-- (3) Globalni beta ON, modul JESTE restriktivan ⇒ NIJE besplatan.
SELECT is(
  public.is_beta_free('hotel_core'),
  false,
  'Restriktivan modul ostaje zatvoren uprkos globalnom beta modu');

-- (4) is_beta_free(NULL) i dalje prati samo globalni beta (nepromijenjena semantika).
SELECT is(
  public.is_beta_free(NULL),
  true,
  'is_beta_free(NULL) prati globalni beta (bez addon konteksta)');

-- (5) per-addon beta_free ima prednost — otključava i restriktivan modul.
SELECT tests.authenticate_as('sa_restr');
UPDATE public.addon_catalog SET beta_free = true WHERE id = 'hotel_core';
SELECT tests.authenticate_as_service_role();
SELECT is(
  public.is_beta_free('hotel_core'),
  true,
  'beta_free=true otključava modul i kad je beta_restricted');

SELECT * FROM finish();
ROLLBACK;
