-- Beta izuzetak po modulu (addon_catalog.beta_restricted)
--
-- ZAŠTO: globalni beta mod (platform_settings.beta_free_mode) otključava SVE module
-- SVIM tenantima. Nedostajala je mogućnost da neki modul ostane zatvoren čak i u beti,
-- pa ga vide samo tenanti kojima ga superadmin eksplicitno dodijeli (subscriptions.addons
-- preko "Addon Override").
--
-- Rješenje: flag beta_restricted. Kad je true, globalni beta NE otključava taj modul;
-- otključava ga samo per-addon beta_free ILI per-tenant grant (kroz hasAddon/subscriptions).
-- beta_free i dalje ima prednost (eksplicitno "besplatno svima") nad restrikcijom.

ALTER TABLE public.addon_catalog
  ADD COLUMN IF NOT EXISTS beta_restricted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.addon_catalog.beta_restricted IS
  'true ⇒ globalni beta mod NE otključava ovaj modul; vide ga samo tenanti s eksplicitnim grantom (subscriptions.addons) ili ako je beta_free=true.';

-- is_beta_free: globalni beta važi samo ako modul NIJE restriktivan; per-addon
-- beta_free uvijek otključava (eksplicitno svima). p_addon_id NULL → ponaša se kao
-- ranije (samo globalni beta), jer nema reda u addon_catalog za lookup.
CREATE OR REPLACE FUNCTION public.is_beta_free(p_addon_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      COALESCE((SELECT beta_free_mode FROM public.platform_settings LIMIT 1), false)
      AND NOT COALESCE((SELECT beta_restricted FROM public.addon_catalog WHERE id = p_addon_id), false)
    )
    OR COALESCE((SELECT beta_free FROM public.addon_catalog WHERE id = p_addon_id), false);
$$;

COMMENT ON FUNCTION public.is_beta_free(TEXT) IS
  'true ⇒ addon je besplatan: (globalni beta mod I modul nije beta_restricted) ILI per-addon beta_free. Koriste ga frontend (checkAddon) i DB RPC-ovi — UI i backend gating identični.';
