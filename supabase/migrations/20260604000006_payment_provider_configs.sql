-- Konfiguracija payment provajdera po tenantu
-- Svaki tenant bira i konfiguriše sopstveni merchant nalog (Stripe/Monri/...)
CREATE TABLE tenant_payment_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN ('stripe', 'monri', 'paypal')),
  mode                  TEXT NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  is_active             BOOLEAN NOT NULL DEFAULT false,
  is_default            BOOLEAN NOT NULL DEFAULT false,
  -- Kredencijali NIKAD u plain tekstu — čuvaju se u Supabase Vault
  -- Ovdje samo referenca na vault secret (UUID)
  credentials_secret_id UUID,
  -- Ne-tajni dio konfiguracije (npr. Monri authenticity_token, brand name)
  public_config         JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  -- Jedan config po provajderu/modu po tenantu
  UNIQUE (restaurant_id, provider, mode)
);

ALTER TABLE tenant_payment_configs ENABLE ROW LEVEL SECURITY;

-- Samo vlasnik restorana može čitati i upravljati payment konfiguracijom
CREATE POLICY "payment_configs_owner" ON tenant_payment_configs
  FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Trigger: samo jedan is_default = true po restaurantu u isto vrijeme
CREATE OR REPLACE FUNCTION fn_enforce_single_default_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Kad se postavlja novi default, obriši default s ostalih redova istog tenanta
  UPDATE tenant_payment_configs
  SET is_default = false
  WHERE restaurant_id = NEW.restaurant_id
    AND id != NEW.id
    AND is_default = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_payment
BEFORE INSERT OR UPDATE OF is_default ON tenant_payment_configs
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION fn_enforce_single_default_payment();
