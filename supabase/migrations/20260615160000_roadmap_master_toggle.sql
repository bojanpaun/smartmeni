-- ============================================================================
-- Master prekidač za roadmap ticker („Šta razvijamo") na dashboardu.
-- ----------------------------------------------------------------------------
-- Do sada se vidljivost na dashboardu kontrolisala SAMO po stavci
-- (platform_roadmap.is_active). Sad superadmin ima i jedan globalni master
-- prekidač koji gasi/pali cijeli ticker odjednom:
--   roadmap_dashboard_enabled = true  → ticker se prikazuje (poštujući is_active po stavci)
--   roadmap_dashboard_enabled = false → ticker se NE prikazuje nikome, bez obzira na is_active
-- Pojedinačni is_active se NE dira → kad se master vrati na true, vidljivost se
-- vraća tačno na stanje kakvo je bilo prije gašenja.
-- Default true ⇒ postojeće ponašanje nepromijenjeno.
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS roadmap_dashboard_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_settings.roadmap_dashboard_enabled IS
  'Master prekidač za roadmap ticker na dashboardu. true ⇒ ticker se prikazuje '
  '(uz is_active po stavci); false ⇒ ticker sakriven svima, is_active stavki ostaje '
  'netaknut (pa se vraćanjem na true obnavlja prethodno stanje). Piše samo superadmin (RLS).';
