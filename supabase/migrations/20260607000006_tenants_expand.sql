-- ============================================================================
-- 2b · FAZA 1 (EXPAND) — uvođenje `tenants` (nalog) uz postojeći `restaurants`
-- ----------------------------------------------------------------------------
-- Cilj: razdvojiti NALOG (billing/vlasništvo) od restoran-vertikale, bez
-- lomljenja ičega. Tehnika: STABILNI ID-jevi — tenants.id == restaurants.id (1:1).
-- Posljedica: `restaurant_id` na svih 23 child tabele VEĆ JESTE tenant id, pa
-- nema re-pointa podataka ni diranja koda u ovoj fazi.
--
-- Ova migracija je čisto ADITIVNA:
--   • kreira `tenants` + RLS (vlasnik + superadmin),
--   • backfill 1:1 iz `restaurants` (kopija account polja),
--   • FK restaurants.id → tenants(id) (dokumentuje 1:1 podtip).
-- Account polja OSTAJU i na `restaurants` (cutover koda je Faza 2; brisanje Faza 5).
-- Postojeće RLS politike i child FK-ovi se NE diraju → svi testovi ostaju zeleni.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id                   UUID PRIMARY KEY,              -- == restaurants.id (stabilno)
  user_id              UUID,
  plan                 TEXT DEFAULT 'starter',
  trial_ends_at        TIMESTAMPTZ,
  plan_expires_at      TIMESTAMPTZ,
  subscription_id      TEXT,
  paypal_customer_id   TEXT,
  suspended_at         TIMESTAMPTZ,
  is_complimentary     BOOLEAN DEFAULT false,
  complimentary_note   TEXT,
  admin_theme          TEXT DEFAULT 'green',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Vlasnik upravlja vlastitim nalogom; superadmin svim (preko is_superadmin()).
-- NIJE javno čitljiv (za razliku od restaurants) — ovo su account/billing podaci.
CREATE POLICY "Vlasnik upravlja svojim nalogom"
  ON public.tenants FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Superadmin upravlja nalozima"
  ON public.tenants FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Backfill 1:1 (isti id) iz postojećih restorana.
INSERT INTO public.tenants
  (id, user_id, plan, trial_ends_at, plan_expires_at, subscription_id, paypal_customer_id,
   suspended_at, is_complimentary, complimentary_note, admin_theme, onboarding_completed, created_at)
SELECT
   id, user_id, plan, trial_ends_at, plan_expires_at, subscription_id, paypal_customer_id,
   suspended_at, is_complimentary, complimentary_note, admin_theme, onboarding_completed, created_at
FROM public.restaurants
ON CONFLICT (id) DO NOTHING;

-- 1:1 veza: restaurants je podtip tenant-a (isti id). Backfill je preduslov.
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_id_tenant_fkey
  FOREIGN KEY (id) REFERENCES public.tenants(id) ON DELETE CASCADE;
