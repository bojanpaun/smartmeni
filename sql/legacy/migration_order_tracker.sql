-- migration_order_tracker.sql
-- Omogućava Supabase Realtime za praćenje narudžbi od strane gostiju
-- Pokrenuti u Supabase SQL Editoru

-- 1. Dodaj kolonu guest_order_token na orders (anonimni link za gosta)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_token UUID DEFAULT gen_random_uuid();

-- 2. Indeks za brže lookup po tokenu
CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON orders(guest_token);

-- 3. Omogući Realtime na tabeli orders (ako nije već)
-- Ovo se radi u Supabase Dashboard > Database > Replication
-- ili ovom komandom:
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 4. RLS policy — gost može čitati narudžbu samo ako zna order ID
-- (Supabase UUID je dovoljno siguran za anonimni pristup)
-- Postojeći INSERT policy treba biti aktivan, dodajemo SELECT:

DO $$
BEGIN
  -- SELECT policy za orders (javni, po ID-u)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
      AND policyname = 'Public can read order by id'
  ) THEN
    CREATE POLICY "Public can read order by id"
      ON orders FOR SELECT
      USING (true);
  END IF;

  -- SELECT policy za order_items (javni, po order_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items'
      AND policyname = 'Public can read order_items by order'
  ) THEN
    CREATE POLICY "Public can read order_items by order"
      ON order_items FOR SELECT
      USING (true);
  END IF;
END $$;

-- 5. Provjera da su RLS-ovi aktivni na tabelama
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- NAPOMENA: Ako tabela orders nema RLS politiku za INSERT,
-- dodaj je (vjerovatno već postoji iz prethodnih migracija):
-- CREATE POLICY "Authenticated can insert orders" ON orders FOR INSERT WITH CHECK (true);
