-- ============================================================================
-- Globalni prekidač: da li nova registracija tenanta MORA na odobrenje superadmina.
-- ----------------------------------------------------------------------------
-- Do sada je svaki novi tenant ČVRSTO išao na 'pending' (trigger). Sad superadmin
-- na /superadmin može uključiti/isključiti taj zahtjev:
--   require_tenant_approval = true  → nova registracija = 'pending' (čeka odobrenje)
--   require_tenant_approval = false → nova registracija = 'approved' (odmah aktivna)
-- Postojeća logika odobravanja (badge, RLS javni read, approve/reject) ostaje ista;
-- mijenja se SAMO početni status koji trigger dodjeljuje pri registraciji.
-- ============================================================================

-- ── 1. Kolona na singleton platform_settings ────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS require_tenant_approval BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.platform_settings.require_tenant_approval IS
  'true ⇒ nova registracija tenanta ide na approval_status=pending (čeka superadmina). '
  'false ⇒ novi tenant se odmah aktivira (approved). Piše samo superadmin (RLS).';

-- ── 2. Trigger čita flag i bira početni status ──────────────────────────────
-- Ostaje defense-in-depth: vrijednost koju klijent pošalje se ignoriše za
-- autentifikovanog ne-superadmina. service_role/seed (auth.uid() IS NULL) i
-- superadmin i dalje NISU dirani — postojeći testovi/skripte rade nepromijenjeno.
CREATE OR REPLACE FUNCTION public.enforce_restaurant_approval_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_require boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
    SELECT COALESCE(require_tenant_approval, true)
      INTO v_require
      FROM public.platform_settings
      LIMIT 1;
    NEW.approval_status := CASE WHEN COALESCE(v_require, true) THEN 'pending' ELSE 'approved' END;
  END IF;
  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.enforce_restaurant_approval_pending() IS
  'Dodjeljuje approval_status novom restoranu autentifikovanog ne-superadmina '
  '(registracija): pending ako platform_settings.require_tenant_approval, inače approved. '
  'Štiti od direktnog API insert-a sa proizvoljnim statusom.';
