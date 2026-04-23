-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS waiter_requests_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN restaurants.waiter_requests_enabled IS 'Da li gosti mogu pozivati konobara putem guest menija';
