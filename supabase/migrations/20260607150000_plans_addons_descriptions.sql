-- ============================================================================
-- Planovi/addoni: opisi + liste funkcija + provajder price-id (za kupovinu)
-- ----------------------------------------------------------------------------
-- Dio 1: plan/addon nose opis i listu funkcija (vidljivo adminu i tenantu, iz DB).
-- Nivo A: plans postaje pun katalog (boja, popular, coming_soon, includes).
-- Nivo B (priprema): kolone za provajderske ID-jeve (Stripe price / PayPal plan),
--   da bi superadmin-kreiran plan mogao biti kupljiv. Same vrijednosti se popune
--   tek kad se proizvodi naprave na strani Stripe/PayPal (ručni korak).
--
-- Seed opisa/funkcija/boja preuzet iz dosadašnjeg hardkodiranog PLANS niza u
-- BillingPage — bez vizuelne regresije nakon prelaska na DB render.
-- ============================================================================

-- ─── plans: deskriptivne + provajderske kolone ───────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description            TEXT,
  ADD COLUMN IF NOT EXISTS features               TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS color                  TEXT,
  ADD COLUMN IF NOT EXISTS is_popular             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coming_soon            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly  TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id          TEXT;

COMMENT ON COLUMN public.plans.features IS 'Lista funkcija (bullet) prikazana tenantu na BillingPage i adminu.';
COMMENT ON COLUMN public.plans.paypal_plan_id IS 'PayPal billing plan ID za ovaj plan (Nivo B). NULL → nije samostalno kupljiv preko PayPala.';
COMMENT ON COLUMN public.plans.coming_soon IS 'true → prikazano kao "uskoro", dugme za kupovinu onemogućeno.';

-- ─── addon_catalog: features (description već postoji) ───────────────────────
ALTER TABLE public.addon_catalog
  ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.addon_catalog.features IS 'Lista funkcija addona (bullet) za UpgradePrompt i admin.';

-- ─── Seed: opis / features / boja / oznake (iz BillingPage PLANS) ─────────────
UPDATE public.plans SET
  description = 'Sve što treba za digitalni meni',
  color = '#6b7280',
  features = ARRAY[
    'Neograničene stavke menija','QR kod i poziv konobara','Digitalno naručivanje',
    'Upravljanje stolovima','Osnovna analitika','Staff portal','Gost profil']
WHERE id = 'starter';

UPDATE public.plans SET
  description = 'Profesionalni alati za restoran',
  color = '#0d7a52',
  features = ARRAY[
    'Sve iz Starter','Napredna analitika i izvještaji','HR Pro — payroll, rasporedi',
    'Upravljanje zalihama','Loyalty program','Restoran sajt','Prioritetna podrška']
WHERE id = 'restaurant';

UPDATE public.plans SET
  description = 'Kompletno upravljanje hotelom',
  color = '#2563eb',
  is_popular = true,
  coming_soon = true,
  features = ARRAY[
    'Sve iz Restoran','Sobe, rezervacije, front desk','Online booking engine',
    'Housekeeping modul','Revenue management','Guest App (/:slug/guest)','Hotel sajt']
WHERE id = 'hotel';

UPDATE public.plans SET
  description = 'Hotel sa Spa & Wellness centrom',
  color = '#7c3aed',
  coming_soon = true,
  features = ARRAY[
    'Sve iz Hotel','Spa & Wellness modul','Spa booking za goste','Email podsjetnici (pg_cron)']
WHERE id = 'hotel_pro';

UPDATE public.plans SET
  description = 'Za lance i grupe objekata — po dogovoru',
  color = '#0f172a',
  features = ARRAY['Sve iz Hotel Pro','Multi-property','Portfolio dashboard','Brand & regional management']
WHERE id = 'enterprise';
