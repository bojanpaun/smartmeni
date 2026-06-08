-- ============================================================================
-- Tenant approval flow — nova registracija ide na odobrenje superadmina
-- ----------------------------------------------------------------------------
-- Sad kad je restby.me javan, novi tenant se NE aktivira automatski. Registracija
-- kreira restoran sa approval_status='pending'; superadmin odobrava (/superadmin).
-- Dok je pending: vlasnik vidi „čeka odobrenje" ekran (app gate), a javna stranica
-- restby.me/slug se NE renderuje (RLS skriva neodobrene od anon-a).
--
-- Gating na 3 nivoa: (1) RLS javni read = samo approved, (2) app AdminRoute gate,
-- (3) superadmin approve/reject UI.
-- ============================================================================

-- ── 1. Kolona ────────────────────────────────────────────────────────────────
-- Default 'approved' → svi POSTOJEĆI tenanti ostaju aktivni/vidljivi.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN restaurants.approval_status IS
  'Status odobrenja tenanta: pending (čeka superadmina) | approved (aktivan) | rejected. '
  'Nova registracija → pending (trigger). RLS skriva ne-approved od javnosti.';

CREATE INDEX IF NOT EXISTS idx_restaurants_approval_status
  ON restaurants(approval_status) WHERE approval_status <> 'approved';

-- ── 2. Trigger: forsiraj pending za nove registracije ───────────────────────
-- Defense-in-depth: bez obzira šta klijent pošalje, autentifikovani ne-superadmin
-- (tj. vlasnik koji se registruje) dobija 'pending'. Service_role/seed (auth.uid()
-- IS NULL) i superadmin NISU dirani — zato postojeći testovi i admin skripte rade.
CREATE OR REPLACE FUNCTION public.enforce_restaurant_approval_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
    NEW.approval_status := 'pending';
  END IF;
  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.enforce_restaurant_approval_pending() IS
  'Forsira approval_status=pending na novim restoranima koje kreira autentifikovani '
  'ne-superadmin (registracija). Štiti od direktnog API insert-a sa approved.';

DROP TRIGGER IF EXISTS trg_enforce_restaurant_approval_pending ON restaurants;
CREATE TRIGGER trg_enforce_restaurant_approval_pending
  BEFORE INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_restaurant_approval_pending();

-- ── 3. RLS: javni read = samo approved ──────────────────────────────────────
-- Stara politika je puštala SVE (USING true). Zamjenjujemo: anon/javnost vidi samo
-- approved. Vlasnik (auth.uid()=user_id) i superadmin imaju SVOJE postojeće FOR ALL
-- politike pa i dalje vide svoj/sve (pending uključen) — ne treba ih ponavljati ovdje.
DROP POLICY IF EXISTS "Restorani su javni za čitanje" ON restaurants;

CREATE POLICY "Javno citanje odobrenih restorana"
  ON restaurants FOR SELECT
  USING (approval_status = 'approved');
