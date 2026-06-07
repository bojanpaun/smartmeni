-- ============================================================================
-- Billing/pricing kontrola za superadmina + beta-free mod
-- ----------------------------------------------------------------------------
-- Cilj: superadmin upravlja cijenama (addoni + planovi) i tim ŠTA se naplaćuje,
-- + globalni "beta" prekidač koji svima daje module besplatno (po izabranim
-- vertikalama), uz mogućnost per-addon prekidača.
--
-- Tri komada:
--   1) platform_settings — singleton red sa globalnim beta_free_mode flagom.
--   2) addon_catalog.beta_free — per-addon "besplatno tokom bete" prekidač.
--   3) plans — PLAN_PRICING + PLAN_INCLUDES premješteni iz JS-a u DB.
--   + helper public.is_beta_free(addon_id) koji koriste i frontend i DB RPC-ovi,
--     da gating bude isti na UI-ju i na backendu (inače UI pokaže, BE odbije).
--
-- NAPOMENA o multi-tenancy: platform_settings i plans su PLATFORM-level config
-- (globalni, jedan za sve tenante) — namjerno BEZ restaurant_id. To je opravdana
-- iznimka od pravila "svaka tabela ima restaurant_id"; zaštita je RLS (čita svako
-- autentifikovan, piše SAMO superadmin). Meta-guardi 004/011 ih preskaču (nemaju
-- restaurant_id), a 000 (RLS uključen) je zadovoljen.
-- ============================================================================

-- ─── 1) PLATFORM SETTINGS (singleton) ───────────────────────────────────────
-- Singleton trik: id je boolean PK sa CHECK (id) → moguć je tačno jedan red.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id              BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  beta_free_mode  BOOLEAN NOT NULL DEFAULT false,
  beta_note       TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.platform_settings IS
  'Singleton platform config. beta_free_mode=true ⇒ svi addoni besplatni za sve (po vertikalama). Piše samo superadmin (RLS).';

INSERT INTO public.platform_settings (id, beta_free_mode)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Svi autentifikovani čitaju (frontend treba znati je li beta aktivna).
CREATE POLICY "Authenticated reads platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- Piše samo superadmin (preko SECURITY DEFINER helpera — konvencija, vidi 20260606000003).
CREATE POLICY "Superadmin manages platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ─── 2) ADDON CATALOG: per-addon beta prekidač ───────────────────────────────
ALTER TABLE public.addon_catalog
  ADD COLUMN IF NOT EXISTS beta_free BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.addon_catalog.beta_free IS
  'true ⇒ ovaj addon je besplatan za sve (per-addon beta), nezavisno od globalnog platform_settings.beta_free_mode.';

-- ─── 3) PLANS (PLAN_PRICING + PLAN_INCLUDES iz JS-a u DB) ─────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id                      TEXT PRIMARY KEY,          -- starter | restaurant | hotel | hotel_pro | enterprise
  name                    TEXT NOT NULL,
  price_monthly           NUMERIC(10,2),             -- NULL = custom / kontakt
  price_annual_per_month  NUMERIC(10,2),
  price_annual_total      NUMERIC(10,2),
  includes                TEXT[],                    -- addon id-jevi; NULL = sve (enterprise)
  is_active               BOOLEAN NOT NULL DEFAULT true,
  sort_order              INT DEFAULT 0,
  updated_at              TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Bundle planovi (cijene + uključeni addoni). Izvor istine za PLAN_PRICING/PLAN_INCLUDES (ranije hardkodirano u planUtils.js). includes NULL = sve (enterprise).';

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmin manages plans"
  ON public.plans FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Seed iz trenutnih JS konstanti (planUtils.js: PLAN_PRICING + PLAN_INCLUDES).
INSERT INTO public.plans (id, name, price_monthly, price_annual_per_month, price_annual_total, includes, sort_order) VALUES
  ('starter',    'Starter',        0,    0,    0,    ARRAY[]::text[],                                                                                                 0),
  ('restaurant', 'Restoran',       29,   23,   276,  ARRAY['analytics_pro','hr_pro','inventory_pro','loyalty'],                                                       10),
  ('hotel',      'Hotel',          79,   63,   756,  ARRAY['analytics_pro','hr_pro','inventory_pro','loyalty','hotel_core','booking_engine','housekeeping','revenue_mgmt'], 20),
  ('hotel_pro',  'Hotel Pro',      119,  95,   1140, ARRAY['analytics_pro','hr_pro','inventory_pro','loyalty','hotel_core','booking_engine','housekeeping','revenue_mgmt','spa_wellness'], 30),
  ('enterprise', 'Enterprise',     NULL, NULL, NULL, NULL,                                                                                                            40)
ON CONFLICT (id) DO UPDATE SET
  name                   = EXCLUDED.name,
  price_monthly          = EXCLUDED.price_monthly,
  price_annual_per_month = EXCLUDED.price_annual_per_month,
  price_annual_total     = EXCLUDED.price_annual_total,
  includes               = EXCLUDED.includes,
  sort_order             = EXCLUDED.sort_order;

-- ─── HELPER: is_beta_free(addon_id) ──────────────────────────────────────────
-- Jedinstvena tačka istine za "je li ovaj addon trenutno besplatan":
--   globalni beta mod  OR  per-addon beta_free.
-- SECURITY DEFINER da ga RPC-ovi/politike mogu zvati bez obzira na RLS čitanje.
CREATE OR REPLACE FUNCTION public.is_beta_free(p_addon_id TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT beta_free_mode FROM public.platform_settings LIMIT 1), false)
    OR COALESCE((SELECT beta_free FROM public.addon_catalog WHERE id = p_addon_id), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_beta_free(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION public.is_beta_free(TEXT) IS
  'true ⇒ addon je besplatan (globalni beta mod ILI per-addon beta_free). Koriste ga frontend (checkAddon) i DB RPC-ovi koji gejtuju addonе — da UI i backend gating budu identični.';
