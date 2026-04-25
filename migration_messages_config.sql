-- migration_messages_config.sql
-- Pokrenuti u Supabase SQL Editoru

-- 1. Kolona za poruke odbijanja narudžbe (JSON niz stringova)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS rejection_messages JSONB DEFAULT NULL;

-- 2. Kolona rejection_message na orders (već možda postoji, koristimo IF NOT EXISTS)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rejection_message TEXT DEFAULT NULL;

-- 3. Realtime za orders (za live prikaz rejection_message gostu)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
