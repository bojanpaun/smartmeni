-- Dodaj onboarding_completed kolonu
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
