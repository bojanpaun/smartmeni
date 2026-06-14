-- ============================================================================
-- vat_rate_key na artiklima (FISK-2b) — referenca na poresku stopu iz tax_config.
-- ----------------------------------------------------------------------------
-- Svaki naplativi artikl nosi `vat_rate_key` (npr. 'STANDARD'/'HOSP'/'BASIC') koji
-- referencira tax_config.rates[].key. Soft-referenca (rates je jsonb po državi, ne
-- može FK) — validira app/assembly. NULL = nije klasifikovan → assembly koristi
-- fallback (STANDARD; vidi FISK-2c). App NE klasifikuje umjesto tenanta (Granice):
-- bez DB default-a, tenant+knjigovođa biraju stopu.
--
-- NE mijenja tip cijene (ostaje numeric(10,2), bruto). Konverzija u centi je na
-- assembly granici (Princip 2).
-- ============================================================================

ALTER TABLE public.menu_items   ADD COLUMN IF NOT EXISTS vat_rate_key text;
ALTER TABLE public.spa_services ADD COLUMN IF NOT EXISTS vat_rate_key text;
ALTER TABLE public.rate_plans   ADD COLUMN IF NOT EXISTS vat_rate_key text;
ALTER TABLE public.minibar_items ADD COLUMN IF NOT EXISTS vat_rate_key text;

COMMENT ON COLUMN public.menu_items.vat_rate_key   IS 'FISK: ključ poreske stope (tax_config.rates[].key). NULL=neklasifikovan → assembly fallback.';
COMMENT ON COLUMN public.spa_services.vat_rate_key IS 'FISK: ključ poreske stope (tax_config.rates[].key). NULL=neklasifikovan → assembly fallback.';
COMMENT ON COLUMN public.rate_plans.vat_rate_key   IS 'FISK: ključ poreske stope (tax_config.rates[].key). NULL=neklasifikovan → assembly fallback.';
COMMENT ON COLUMN public.minibar_items.vat_rate_key IS 'FISK: ključ poreske stope (tax_config.rates[].key). NULL=neklasifikovan → assembly fallback.';
