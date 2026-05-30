ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS hotel_visibility TEXT DEFAULT 'off';
