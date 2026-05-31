-- Nadogradnja subscriptions tabele na novi plan model
-- plan: 'starter' | 'restaurant' | 'hotel' | 'hotel_pro' | 'enterprise'
-- (stari 'pro' → 'restaurant' radi backward compat)

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'annual';

-- Migracija: 'pro' → 'restaurant'
UPDATE subscriptions SET plan = 'restaurant' WHERE plan = 'pro';
