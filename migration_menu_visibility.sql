-- Vidljivost opcija u digitalnom meniju
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS ordering_visibility TEXT DEFAULT 'all' CHECK (ordering_visibility IN ('off','registered','all')),
  ADD COLUMN IF NOT EXISTS waiter_visibility TEXT DEFAULT 'all' CHECK (waiter_visibility IN ('off','registered','all')),
  ADD COLUMN IF NOT EXISTS reservation_visibility TEXT DEFAULT 'all' CHECK (reservation_visibility IN ('off','registered','all')),
  ADD COLUMN IF NOT EXISTS registration_visibility TEXT DEFAULT 'all' CHECK (registration_visibility IN ('off','registered','all'));

NOTIFY pgrst, 'reload schema';
