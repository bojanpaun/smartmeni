-- PAY-3: Sigurno čuvanje payment kredencijala
-- Odvojena tabela bez SELECT politike za authenticated korisnike
-- = kredencijali NISU vidljivi frontendu/RLS kontekstu;
-- Edge Functions ih čitaju via service_role (bypass RLS)

CREATE TABLE payment_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     UUID NOT NULL REFERENCES tenant_payment_configs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Sadržaj: { "secret_key": "sk_test_...", "webhook_secret": "whsec_..." }
  -- ili za Monri: { "merchant_key": "...", "authenticity_token": "..." }
  credentials   JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (config_id)
);

ALTER TABLE payment_credentials ENABLE ROW LEVEL SECURITY;

-- ⚠ NEMA SELECT politike za authenticated korisnike namjerno —
-- samo service_role (Edge Functions) može čitati sadržaj kredencijala

CREATE POLICY "payment_creds_insert" ON payment_credentials
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "payment_creds_update" ON payment_credentials
  FOR UPDATE USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "payment_creds_delete" ON payment_credentials
  FOR DELETE USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- SECURITY DEFINER: čuva/ažurira kredencijale (INSERT ON CONFLICT UPDATE)
-- Provjerava ownership, ne vraća sadržaj kredencijala
CREATE OR REPLACE FUNCTION save_payment_credentials(
  p_config_id  UUID,
  p_credentials JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id
  FROM tenant_payment_configs WHERE id = p_config_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Config nije pronađen';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = v_restaurant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO payment_credentials (config_id, restaurant_id, credentials)
  VALUES (p_config_id, v_restaurant_id, p_credentials)
  ON CONFLICT (config_id) DO UPDATE
    SET credentials = EXCLUDED.credentials,
        updated_at  = now();

  UPDATE tenant_payment_configs SET updated_at = now() WHERE id = p_config_id;
  RETURN true;
END;
$$;

-- SECURITY DEFINER: vraća samo boolean — jesu li kredencijali postavljeni
-- Frontend može provjeriti bez da vidi sadržaj
CREATE OR REPLACE FUNCTION check_payment_credentials(p_config_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM payment_credentials WHERE config_id = p_config_id);
$$;
