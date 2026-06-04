-- Evidencija svih platnih transakcija — provajder-agnostična
-- Svaka naplata (booking, folio, spa, narudžba) prolazi kroz ovu tabelu
CREATE TABLE payment_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,                   -- 'stripe' | 'monri' | 'paypal'
  provider_ref     TEXT NOT NULL,                   -- ID transakcije kod provajdera
  idempotency_key  TEXT NOT NULL,                   -- sprečava duplu naplatu
  source_type      TEXT NOT NULL CHECK (source_type IN ('booking', 'folio', 'order', 'spa')),
  source_id        UUID,                            -- FK na rezervaciju/folio/narudžbu
  amount_minor     BIGINT NOT NULL,                 -- iznos u centima (EUR)
  currency         TEXT NOT NULL DEFAULT 'EUR',
  -- Normalizovani status — nikad provajder-specifičan string
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','requires_action','authorized','paid',
                                     'failed','refunded','partially_refunded','cancelled')),
  raw_payload      JSONB,                           -- sirovi webhook/callback za audit
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  -- Idempotencija: jedna transakcija po idempotency_key po tenantu
  UNIQUE (restaurant_id, idempotency_key)
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_owner" ON payment_transactions
  FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Index za brzo lookup po source (folio/rezervacija → transakcije)
CREATE INDEX idx_payment_transactions_source
  ON payment_transactions (restaurant_id, source_type, source_id);

-- Index za status filter (pending → paid monitoring)
CREATE INDEX idx_payment_transactions_status
  ON payment_transactions (restaurant_id, status, created_at DESC);
