-- ============================================================================
-- 2b · FAZA 4c — active_verticals na restaurants (javno čitljivo)
-- ----------------------------------------------------------------------------
-- Javni guest sajt (/:slug, anon) i staff (oba čitaju restaurants javnom SELECT
-- politikom) treba da znaju koje su vertikale aktivne — a tenants je privatan.
-- Zato active_verticals stavljamo na restaurants (javni profil/tenant-root) kao
-- IZVOR za gating i public routing. tenants.active_verticals ostaje (vestigijalno,
-- uklanja se u Fazi 5).
-- ============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS active_verticals TEXT[] NOT NULL DEFAULT '{restaurant}';

-- Backfill iz tenants (Faza 3 podaci).
UPDATE public.restaurants r
   SET active_verticals = t.active_verticals
  FROM public.tenants t
 WHERE t.id = r.id;
