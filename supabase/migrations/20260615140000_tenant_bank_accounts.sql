-- ============================================================================
-- FISK #4 — više IBAN računa po tenantu.
-- ----------------------------------------------------------------------------
-- Do sada: jedan restaurants.iban. Sada: tenant_bank_accounts (više računa, jedan
-- primarni). restaurants.iban OSTAJE kao MIRROR primarnog računa (trigger) → print
-- računa i postojeći čitači se NE mijenjaju (uvijek vide primarni IBAN).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_bank_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  iban          text NOT NULL,
  label         text,                                   -- npr. „Glavni", „Devizni"
  is_primary    boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.tenant_bank_accounts IS
  'Bankovni računi (IBAN) tenanta. Jedan primarni (is_primary) mirror-uje se na restaurants.iban (trigger) → fiskalni računi koriste primarni.';

CREATE INDEX IF NOT EXISTS idx_tba_restaurant ON public.tenant_bank_accounts(restaurant_id, sort_order);
-- Najviše jedan primarni po tenantu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tba_one_primary ON public.tenant_bank_accounts(restaurant_id) WHERE is_primary;

-- ── RLS: tenant upravlja svojim, superadmin sve ─────────────────────────────
ALTER TABLE public.tenant_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant upravlja svojim bankovnim računima" ON public.tenant_bank_accounts FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE TRIGGER tba_updated_at BEFORE UPDATE ON public.tenant_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── BEFORE INSERT: prvi račun tenanta automatski postaje primarni ───────────
CREATE OR REPLACE FUNCTION public._tba_auto_primary() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_bank_accounts WHERE restaurant_id = NEW.restaurant_id AND is_primary) THEN
    NEW.is_primary := true;
  END IF;
  RETURN NEW;
END; $$;
COMMENT ON FUNCTION public._tba_auto_primary() IS 'Prvi bankovni račun tenanta automatski je primarni (invariant: tenant sa računima ima primarni).';
CREATE TRIGGER trg_tba_auto_primary BEFORE INSERT ON public.tenant_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public._tba_auto_primary();

-- ── AFTER write: mirror primarni IBAN na restaurants.iban ───────────────────
CREATE OR REPLACE FUNCTION public._tba_mirror_iban() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid := COALESCE(NEW.restaurant_id, OLD.restaurant_id); v_iban text;
BEGIN
  SELECT iban INTO v_iban FROM tenant_bank_accounts WHERE restaurant_id = v_rest AND is_primary LIMIT 1;
  UPDATE restaurants SET iban = v_iban WHERE id = v_rest;
  RETURN NULL;
END; $$;
COMMENT ON FUNCTION public._tba_mirror_iban() IS 'Drži restaurants.iban = IBAN primarnog bankovnog računa (ili NULL ako nema). Tako fiskalni print ne mijenjamo.';
CREATE TRIGGER trg_tba_mirror_iban AFTER INSERT OR UPDATE OR DELETE ON public.tenant_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public._tba_mirror_iban();

-- ── RPC: atomarno postavi primarni (skine stari, postavi novi) ──────────────
CREATE OR REPLACE FUNCTION public.set_primary_bank_account(p_account_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid;
BEGIN
  SELECT restaurant_id INTO v_rest FROM tenant_bank_accounts WHERE id = p_account_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'Bankovni račun ne postoji' USING ERRCODE = '22023'; END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = v_rest AND r.user_id = auth.uid())
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;
  UPDATE tenant_bank_accounts SET is_primary = false WHERE restaurant_id = v_rest AND is_primary AND id <> p_account_id;
  UPDATE tenant_bank_accounts SET is_primary = true  WHERE id = p_account_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_primary_bank_account FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_primary_bank_account TO authenticated;

-- ── Seed: postojeći restaurants.iban → primarni bankovni račun ──────────────
INSERT INTO public.tenant_bank_accounts (restaurant_id, iban, is_primary)
SELECT id, iban, true FROM public.restaurants WHERE iban IS NOT NULL AND trim(iban) <> '';
