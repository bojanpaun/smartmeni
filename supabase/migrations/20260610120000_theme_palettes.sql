-- ============================================================================
-- THEME PALETTES — superadmin-definisane custom palete (brend boje), globalno.
-- ----------------------------------------------------------------------------
-- Omogućava da superadmin KROZ APP (bez kodiranja CSS-a) kreira palete: bira
-- ~7 brend tokena (primary familija + sidebar) za light i dark. Frontend ih
-- primjenjuje preko documentElement.style.setProperty (vidi useTheme.js); ostali
-- tokeni (tekst/pozadine/danger/...) naslijede bazni green (light) / green-dark.
-- restaurants.admin_theme čuva 'key' palete (uz ugrađene 'green'/'blue'/'purple').
--
-- Globalna tabela (kao addon_catalog/platform_settings) — NEMA restaurant_id
-- (svjestan izuzetak od multi-tenancy pravila: superadmin-konfiguracija).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.theme_palettes (
  key        text PRIMARY KEY,
  name       text NOT NULL,
  light      jsonb NOT NULL DEFAULT '{}'::jsonb,
  dark       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.theme_palettes IS
  'Superadmin custom palete (brend boje). light/dark = mapa {primary,primaryHover,primaryMedium,primaryLight,primaryMuted,sbBg,sbAccent}. Primjenjuje frontend (useTheme.js).';

ALTER TABLE public.theme_palettes ENABLE ROW LEVEL SECURITY;

-- Svi autentifikovani čitaju (frontend mora primijeniti paletu po tenantu).
CREATE POLICY "Authenticated reads palettes"
  ON public.theme_palettes FOR SELECT
  TO authenticated
  USING (true);

-- Piše samo superadmin (SECURITY DEFINER helper — konvencija, izbjegava recursion).
CREATE POLICY "Superadmin manages palettes"
  ON public.theme_palettes FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
