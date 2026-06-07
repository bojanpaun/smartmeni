-- ============================================================================
-- 2b · FAZA 1 (hitna dopuna) — auto-kreiranje tenant-a pri unosu restorana
-- ----------------------------------------------------------------------------
-- FK restaurants.id → tenants(id) (20260607000006) zahtijeva da tenant postoji
-- PRIJE restorana. Svi postojeći insert putevi (registracija Register.jsx,
-- pgTAP testovi) ubacuju restoran direktno → bez ovoga pucaju na FK.
--
-- BEFORE INSERT trigger auto-kreira odgovarajući tenant (isti id, kopija account
-- polja) prije nego red restorana stigne do FK provjere. Time:
--   • produkcijska registracija radi bez izmjene koda,
--   • testovi koji seeduju restaurants rade,
--   • tenants ostaje kompletan i za NOVE restorane (ne samo backfill).
-- Privremeno tokom 2b; u Fazi 4 registracija će eksplicitno kreirati tenant,
-- pa se ovaj trigger može ukloniti.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_restaurant_ensure_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenants
    (id, user_id, plan, trial_ends_at, plan_expires_at, subscription_id, paypal_customer_id,
     suspended_at, is_complimentary, complimentary_note, admin_theme, onboarding_completed, created_at)
  VALUES
    (NEW.id, NEW.user_id, NEW.plan, NEW.trial_ends_at, NEW.plan_expires_at, NEW.subscription_id, NEW.paypal_customer_id,
     NEW.suspended_at, NEW.is_complimentary, NEW.complimentary_note, NEW.admin_theme, NEW.onboarding_completed,
     COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_ensure_tenant
  BEFORE INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_restaurant_ensure_tenant();
