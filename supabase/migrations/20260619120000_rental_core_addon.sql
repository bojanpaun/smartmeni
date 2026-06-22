-- ============================================================================
-- Addon 'rental_core' (Faza RENT v2.1) — registracija u addon_catalog (izvor istine).
-- ----------------------------------------------------------------------------
-- Treća vertikala (`rental`) uz restaurant/hotel. Generički motor najma
-- (asset_kind: accommodation sad / vehicle kasnije). KREĆE od plažnog imobilijara.
-- Gejtuje se <AddonGuard addonId="rental_core"> (route-level) + hasAddon('rental_core').
-- BEZ depends_on — čist rental tenant ga aktivira bez hotel_core. Samostalan
-- per-tenant addon (nije u bundle planovima planUtils.PLAN_INCLUDES → ide kroz
-- subscriptions.addons). `rental_fleet` (vozila) se NE dodaje dok se ne grade.
-- Cijena je placeholder — superadmin je mijenja na /superadmin/billing.
-- ============================================================================

INSERT INTO public.addon_catalog (id, name, description, price_yearly, price_monthly, category, sort_order, depends_on)
VALUES (
  'rental_core',
  'Rental Core',
  'Najam: sredstva na više lokacija, multi-asset kalendar sa zaštitom od dvostruke rezervacije, sezonske cijene, direktne rezervacije, boravišna taksa, prijava gostiju i self check-in.',
  299, 29, 'rental', 200, NULL
)
ON CONFLICT (id) DO NOTHING;
