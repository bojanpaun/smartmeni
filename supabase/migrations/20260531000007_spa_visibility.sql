-- Dodaj spa_visibility kolonu u restaurants (kao hotel_visibility)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS spa_visibility TEXT DEFAULT 'off';
