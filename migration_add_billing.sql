-- Billing polja u restaurants tabeli
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
ADD COLUMN IF NOT EXISTS subscription_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ DEFAULT NULL;

-- Postavi sve postojeće restorane na trial
UPDATE restaurants
SET 
  plan = 'starter',
  trial_ends_at = NOW() + INTERVAL '14 days'
WHERE plan IS NULL;
