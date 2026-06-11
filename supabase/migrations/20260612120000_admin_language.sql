-- ============================================================================
-- admin_language — per-tenant jezik admin panela (multilingvalno, Faza 0)
-- ----------------------------------------------------------------------------
-- Tenant bira JEDAN jezik za admin (default 'me'); javne stranice su zasebno
-- multilingvalne (gost bira). Prati isti šablon kao admin_theme: kolona duplirana
-- na restaurants + tenants, mirror trigger drži tenants sinhron, autocreate
-- trigger kopira pri unosu novog restorana. Izvor čitanja = tenants (PlatformContext).
-- Vidi memoriju [[project-i18n-multilingual]] i [[project-tenant-model]].
-- ============================================================================

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS admin_language text NOT NULL DEFAULT 'me';
ALTER TABLE public.tenants     ADD COLUMN IF NOT EXISTS admin_language text DEFAULT 'me';

-- Mirror trigger (AFTER UPDATE restaurants → tenants) — dopunjen sa admin_language.
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
    admin_language       = NEW.admin_language,
    onboarding_completed = NEW.onboarding_completed,
    updated_at           = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Autocreate trigger (BEFORE INSERT restaurants → tenants) — dopunjen sa admin_language.
CREATE OR REPLACE FUNCTION public.trg_fn_restaurant_ensure_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenants
    (id, user_id, plan, trial_ends_at, plan_expires_at, subscription_id, paypal_customer_id,
     suspended_at, is_complimentary, complimentary_note, admin_theme, admin_language,
     onboarding_completed, created_at)
  VALUES
    (NEW.id, NEW.user_id, NEW.plan, NEW.trial_ends_at, NEW.plan_expires_at, NEW.subscription_id, NEW.paypal_customer_id,
     NEW.suspended_at, NEW.is_complimentary, NEW.complimentary_note, NEW.admin_theme, NEW.admin_language,
     NEW.onboarding_completed, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill postojećih tenants.
UPDATE public.tenants t SET admin_language = r.admin_language
FROM public.restaurants r
WHERE t.id = r.id AND t.admin_language IS DISTINCT FROM r.admin_language;
