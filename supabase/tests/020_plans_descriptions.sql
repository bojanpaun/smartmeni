-- ============================================================================
-- plans/addon_catalog — deskriptivne kolone + seed integritet
-- ----------------------------------------------------------------------------
-- Plan/addon nose opis i listu funkcija; seed iz BillingPage prenesen u DB.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

-- (1) Restoran plan ima opis i bar jednu funkciju.
SELECT ok(
  (SELECT description IS NOT NULL AND cardinality(features) > 0
     FROM public.plans WHERE id = 'restaurant'),
  'plans: Restoran ima opis i listu funkcija (seed)');

-- (2) Hotel je označen kao coming_soon (iz BillingPage).
SELECT is(
  (SELECT coming_soon FROM public.plans WHERE id = 'hotel'),
  true,
  'plans: Hotel je coming_soon');

-- (3) Boja plana je postavljena (BillingPage kartice).
SELECT isnt(
  (SELECT color FROM public.plans WHERE id = 'restaurant'),
  NULL,
  'plans: Restoran ima boju');

-- (4) addon_catalog.features kolona postoji (default prazan niz, ne NULL).
SELECT is(
  (SELECT features FROM public.addon_catalog WHERE id = 'inventory_pro'),
  ARRAY[]::text[],
  'addon_catalog.features default = prazan niz');

SELECT * FROM finish();
ROLLBACK;
