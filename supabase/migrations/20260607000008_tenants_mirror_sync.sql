-- ============================================================================
-- 2b · FAZA 2 — ogledanje account polja restaurants → tenants (izvor istine)
-- ----------------------------------------------------------------------------
-- Cilj: tenants postaje pouzdan IZVOR za čitanje account/billing polja, bez
-- diranja postojećih PISACA (SuperAdminPanel, Stripe/PayPal edge webhookovi i
-- dalje pišu u restaurants). AFTER UPDATE trigger ogleda promjene u tenants.
-- Tako PlatformContext može čitati account iz tenants, a da ništa ne polomimo.
--
-- (BEFORE INSERT auto-create je 20260607000007; ovaj pokriva UPDATE putanju.)
-- U Fazi 5: pisci se prebace direktno na tenants, account kolone se uklone s
-- restaurants, a ovaj mirror trigger se briše.
-- ============================================================================

-- Re-sync (za slučaj izmjena između Faze 1 i sad).
UPDATE public.tenants t SET
  user_id              = r.user_id,
  plan                 = r.plan,
  trial_ends_at        = r.trial_ends_at,
  plan_expires_at      = r.plan_expires_at,
  subscription_id      = r.subscription_id,
  paypal_customer_id   = r.paypal_customer_id,
  suspended_at         = r.suspended_at,
  is_complimentary     = r.is_complimentary,
  complimentary_note   = r.complimentary_note,
  admin_theme          = r.admin_theme,
  onboarding_completed = r.onboarding_completed,
  updated_at           = now()
FROM public.restaurants r
WHERE t.id = r.id;

CREATE OR REPLACE FUNCTION public.trg_fn_restaurant_sync_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenants SET
    user_id              = NEW.user_id,
    plan                 = NEW.plan,
    trial_ends_at        = NEW.trial_ends_at,
    plan_expires_at      = NEW.plan_expires_at,
    subscription_id      = NEW.subscription_id,
    paypal_customer_id   = NEW.paypal_customer_id,
    suspended_at         = NEW.suspended_at,
    is_complimentary     = NEW.is_complimentary,
    complimentary_note   = NEW.complimentary_note,
    admin_theme          = NEW.admin_theme,
    onboarding_completed = NEW.onboarding_completed,
    updated_at           = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_sync_tenant
  AFTER UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_restaurant_sync_tenant();
