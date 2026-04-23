-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: opis restorana i online rezervacije toggle

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS online_reservations BOOLEAN DEFAULT false;

COMMENT ON COLUMN restaurants.description IS 'Kratki opis restorana vidljiv gostima u meniju';
COMMENT ON COLUMN restaurants.online_reservations IS 'Da li restoran prima online rezervacije putem stranice menija';
