-- ============================================================================
-- Poslovni identitet prodavca (FISK-2): PIB / PDV broj / IBAN na restaurants.
-- ----------------------------------------------------------------------------
-- Identifikacija PRODAVCA na fiskalnom računu (seller blok). Tenant ih unosi pri
-- registraciji (OnboardingWizard, OPCIONALNO — ne blokira signup) i mijenja u
-- /admin/settings/general. Obavezni postaju tek kad se uključi fiskalizacija
-- (validacija u FISK-3, ne ovdje).
--
-- Profil/identitet polja (kao name/location/phone) → žive SAMO na restaurants
-- (javno čitljivo; pojavljuju se na računu koji je ionako poludokument), bez
-- mirrora na tenants. NISU tajne (IBAN/PIB se štampaju na računu).
-- ============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS tax_id     text,   -- PIB (poreski identifikacioni broj)
  ADD COLUMN IF NOT EXISTS vat_number text,   -- PDV broj (registar PDV obveznika)
  ADD COLUMN IF NOT EXISTS iban       text;   -- žiro/bankovni račun (IBAN) za uplatu

COMMENT ON COLUMN public.restaurants.tax_id IS
  'FISK: PIB prodavca (seller blok računa). Opcionalan dok se ne uključi fiskalizacija.';
COMMENT ON COLUMN public.restaurants.vat_number IS
  'FISK: PDV broj prodavca (registar PDV obveznika). Opcionalan dok se ne uključi fiskalizacija.';
COMMENT ON COLUMN public.restaurants.iban IS
  'FISK: žiro/bankovni račun (IBAN) prodavca — podatak za uplatu na računu. Opcionalan.';
