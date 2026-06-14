-- ============================================================================
-- platform_roadmap — „Šta razvijamo" najave budućih funkcionalnosti (globalno).
-- ----------------------------------------------------------------------------
-- Trajna, NE-dismissible tabla koju superadmin kurira; vidljiva svim korisnicima
-- diskretno na dashboardu (ticker). Razlikuje se od platform_announcements (te su
-- vremenski osjetljivi dismissible banneri sa read-tracking-om) — ovo nema dismiss,
-- read ni expire. Bez restaurant_id (globalno, kao addon_catalog/tax_config).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_roadmap (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  sort_order  int  NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.platform_roadmap IS
  'Roadmap najave (Šta razvijamo) — superadmin kurira, svi korisnici vide diskretno na dashboardu (ticker). Bez dismiss/read/expire (za razliku od platform_announcements).';

ALTER TABLE public.platform_roadmap ENABLE ROW LEVEL SECURITY;

-- Čitanje: svi prijavljeni vide AKTIVNE; superadmin vidi i neaktivne (drafts) radi
-- upravljanja.
CREATE POLICY "Roadmap aktivne čitljive prijavljenima"
  ON public.platform_roadmap FOR SELECT
  USING (is_active = true OR public.is_superadmin());

-- Pisanje: samo superadmin (kurira). is_superadmin() helper (konvencija, §1).
CREATE POLICY "Superadmin upravlja roadmap-om"
  ON public.platform_roadmap FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER platform_roadmap_updated_at
  BEFORE UPDATE ON public.platform_roadmap
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: par primjera (superadmin ih uređuje/briše). Iz aktuelnog razvoja.
INSERT INTO public.platform_roadmap (title, description, sort_order) VALUES
  ('Fiskalni računi', 'Univerzalni računi sa PDV obračunom i fiskalizacija po zemlji (Crna Gora i region).', 10),
  ('Lista i izdavanje računa', 'Pregled izdatih računa sa PDV razradom i izdavanje računa iz narudžbe/folija.', 20),
  ('Više valuta', 'Rad u valuti tenanta kroz cijelu aplikaciju (EUR, RSD, …).', 30)
ON CONFLICT DO NOTHING;
