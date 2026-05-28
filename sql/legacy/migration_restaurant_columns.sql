-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Dodaje sve potrebne kolone u restaurants tabelu

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS digital_ordering BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS online_reservations BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiter_requests_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Osvježi Supabase schema cache
NOTIFY pgrst, 'reload schema';
