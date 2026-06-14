-- ============================================================================
-- Addon 'fiscalization' (Faza FISK) — registracija u addon_catalog (izvor istine).
-- ----------------------------------------------------------------------------
-- Univerzalno jezgro (valuta, PDV motor, sklapanje računa, numeracija) je dostupno
-- svima; OVAJ addon otključava country-specifičnu fiskalizaciju (CG i region) —
-- veza s poreskom upravom (provajder, FISK-3), izdavanje/štampa računa, izvještaji.
-- Radi za OBJE vertikale (kao inventory_pro/hr_pro). Gejtuje se <AddonGuard
-- addonId="fiscalization"> (route-level) + hasAddon('fiscalization') u komponentama.
-- Cijena je placeholder — superadmin je mijenja na /superadmin/billing.
-- ============================================================================

INSERT INTO public.addon_catalog (id, name, description, price_yearly, price_monthly, category, sort_order, depends_on)
VALUES (
  'fiscalization',
  'Fiskalizacija',
  'Univerzalni računi sa PDV obračunom i fiskalizacija po zemlji (Crna Gora i region): povezivanje s poreskom upravom, numeracija, IKOF/JIKR/QR na računu i poreski izvještaji.',
  199, 19, 'restaurant', 35, NULL
)
ON CONFLICT (id) DO NOTHING;
