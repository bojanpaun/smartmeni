-- ============================================================================
-- tax_config — GLOBALNA superadmin referenca poreske konfiguracije po državi (FISK-1)
-- ----------------------------------------------------------------------------
-- Country-modul ugovor (vidi roadmap Faza FISK): svaka država isporučuje stope
-- PDV-a, strategiju zaokruživanja, format broja računa, obavezne elemente računa i
-- obaveznu valutu. GLOBALNA tabela (bez restaurant_id) — kao recipe_library /
-- theme_palettes / plans: superadmin upravlja, svi prijavljeni čitaju.
--
-- PDV motor (src/lib/vat.js) čita `rates` po `vat_rate_key` (default po kategoriji,
-- vidi FISK-2). App NE klasifikuje artikle umjesto tenanta (Granice) — nudi config.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tax_config (
  country                 text PRIMARY KEY,            -- ISO 3166-1 alpha-2 ('ME')
  currency                text NOT NULL,               -- obavezna valuta države (ISO 4217)
  rates                   jsonb NOT NULL,              -- [{key,value,label}] value=decimalna stopa (0.21)
  rounding                text NOT NULL DEFAULT 'half_up_2',  -- strategija zaokruživanja (na nivou poreske grupe)
  numbering_format        text,                        -- šablon broja računa (potvrditi prije FISK-2; NULL dok se ne potvrdi)
  receipt_required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

COMMENT ON TABLE public.tax_config IS
  'FISK-1: globalna poreska konfiguracija po državi (stope/zaokruživanje/format broja/obavezni elementi/valuta). Bez restaurant_id (superadmin-globalna referenca). PDV motor čita rates po vat_rate_key.';
COMMENT ON COLUMN public.tax_config.rates IS
  'JSON niz [{key,value,label}]: key=stabilni ključ (STANDARD/HOSP/BASIC), value=decimalna stopa (0.21=21%), label=prikaz. vat_rate_key na artiklima referencira key.';

ALTER TABLE public.tax_config ENABLE ROW LEVEL SECURITY;

-- Čitanje: svaki prijavljeni (pricing/preview na admin površinama).
CREATE POLICY "Tax config čitljiv prijavljenima"
  ON public.tax_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Pisanje: samo superadmin (kurira poreske stope). is_superadmin() helper — konvencija
-- (NIKAD inline EXISTS, vidi CLAUDE.md §1: ciklus user_profiles→restaurants).
CREATE POLICY "Superadmin upravlja tax config-om"
  ON public.tax_config FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER tax_config_updated_at
  BEFORE UPDATE ON public.tax_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed: Crna Gora (ME) ────────────────────────────────────────────────────
-- Stope iz roadmap-a (FISK). Klasifikacija artikala je na tenantu+knjigovođi (Granice).
-- numbering_format NULL dok se tačan ME šablon ne potvrdi (BLOCKING prije FISK-2).
INSERT INTO public.tax_config (country, currency, rates, rounding, numbering_format, receipt_required_fields)
VALUES (
  'ME', 'EUR',
  '[
    {"key":"STANDARD","value":0.21,"label":"Standardna (21%)"},
    {"key":"HOSP","value":0.15,"label":"Ugostiteljstvo (15%)"},
    {"key":"BASIC","value":0.07,"label":"Snižena (7%)"}
  ]'::jsonb,
  'half_up_2',
  NULL,
  '["enu_code","invoice_number","issued_at","iic","fic","qr"]'::jsonb
)
ON CONFLICT (country) DO NOTHING;
