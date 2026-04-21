-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migration: add complimentary plan support

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS complimentary_note TEXT;

CREATE INDEX IF NOT EXISTS idx_restaurants_is_complimentary
  ON restaurants (is_complimentary)
  WHERE is_complimentary = true;

COMMENT ON COLUMN restaurants.is_complimentary IS
  'Super admin može dodijeliti besplatni Pro pristup. Ovaj flag preskače sve billing provjere.';
COMMENT ON COLUMN restaurants.complimentary_note IS
  'Razlog za besplatni pristup, npr. "Beta tester", "Partner restoran", "Nagradni period"';
