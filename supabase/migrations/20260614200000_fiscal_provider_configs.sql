-- ============================================================================
-- FISK-3 skelet — tenant_fiscal_configs + fiscal_credentials (ogledalo payment-a).
-- ----------------------------------------------------------------------------
-- Per-tenant fiskalna konfiguracija + privatni kredencijali (cert/ključ). Kalup je
-- IDENTIČAN payments apstrakciji: config tabela (javno-ish, RLS owner) + credentials
-- tabela BEZ SELECT politike (čita samo service_role iz Edge-a). Provajder je
-- dormant dok se ne potvrdi Fisver ugovor (kao Monri prije ključeva).
-- ============================================================================

-- ── tenant_fiscal_configs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_fiscal_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider              text NOT NULL DEFAULT 'stub' CHECK (provider IN ('fisver', 'stub')),
  country               text NOT NULL DEFAULT 'ME',     -- vozi tax_config + format broja
  mode                  text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  enu_code              text,            -- elektronski naplatni uređaj (ENU)
  business_unit_code    text,            -- oznaka poslovnog prostora
  operator_code         text,            -- podrazumijevani operater
  is_active             boolean NOT NULL DEFAULT false,
  is_default            boolean NOT NULL DEFAULT false,
  credentials_secret_id uuid,            -- referenca na fiscal_credentials / vault
  public_config         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- ne-tajni dio (adresa, naziv ENU…)
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE (restaurant_id, provider, mode)
);

COMMENT ON TABLE public.tenant_fiscal_configs IS
  'FISK-3: per-tenant fiskalna konfiguracija (ogledalo tenant_payment_configs). enu_code/business_unit_code/operator vode numeraciju i fiskalizaciju. credentials_secret_id → fiscal_credentials.';

ALTER TABLE public.tenant_fiscal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_configs_owner" ON public.tenant_fiscal_configs
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE TRIGGER tenant_fiscal_configs_updated_at
  BEFORE UPDATE ON public.tenant_fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── fiscal_credentials (BEZ SELECT politike — čita samo service_role) ────────
CREATE TABLE IF NOT EXISTS public.fiscal_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     uuid NOT NULL REFERENCES public.tenant_fiscal_configs(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  credentials   jsonb NOT NULL,           -- privatni ključ / vault_key_id / cert (NIKAD u app sloj)
  issuer        text,                      -- izdavalac certifikata (Pošta CG / CoreIT)
  valid_until   timestamptz,               -- istek certifikata (alert pred istek; istekao blokira)
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (config_id)
);

COMMENT ON TABLE public.fiscal_credentials IS
  'FISK-3: privatni fiskalni kredencijali (cert/ključ). NEMA SELECT politike — čita samo service_role iz Edge-a (kao payment_credentials). valid_until: istekao cert blokira fiskalizaciju.';

ALTER TABLE public.fiscal_credentials ENABLE ROW LEVEL SECURITY;

-- ⚠ NEMA SELECT politike za authenticated namjerno — sadržaj kredencijala čita
-- samo service_role (Edge Functions). Vlasnik smije upisati/izmijeniti/obrisati.
CREATE POLICY "fiscal_creds_insert" ON public.fiscal_credentials
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_creds_update" ON public.fiscal_credentials
  FOR UPDATE USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_creds_delete" ON public.fiscal_credentials
  FOR DELETE USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE TRIGGER fiscal_credentials_updated_at
  BEFORE UPDATE ON public.fiscal_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SECURITY DEFINER: čuva/ažurira kredencijale; provjerava ownership, NE vraća sadržaj.
CREATE OR REPLACE FUNCTION public.save_fiscal_credentials(
  p_config_id   uuid,
  p_credentials jsonb,
  p_issuer      text DEFAULT NULL,
  p_valid_until timestamptz DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id FROM tenant_fiscal_configs WHERE id = p_config_id;
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Fiskalni config % ne postoji', p_config_id USING ERRCODE = '22023';
  END IF;
  IF NOT (EXISTS (SELECT 1 FROM restaurants WHERE id = v_restaurant_id AND user_id = auth.uid()) OR public.is_superadmin()) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;

  INSERT INTO fiscal_credentials (config_id, restaurant_id, credentials, issuer, valid_until)
  VALUES (p_config_id, v_restaurant_id, p_credentials, p_issuer, p_valid_until)
  ON CONFLICT (config_id) DO UPDATE
    SET credentials = EXCLUDED.credentials, issuer = EXCLUDED.issuer,
        valid_until = EXCLUDED.valid_until, updated_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.save_fiscal_credentials FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_fiscal_credentials TO authenticated;
