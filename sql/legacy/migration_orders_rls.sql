-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- RLS policy za kreiranje narudžbi od strane gostiju (anonimnih korisnika)

-- Provjeri da orders tabela ima sve potrebne kolone
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS menu_item_id UUID,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category_id UUID;

-- Dozvoli anonimnim korisnicima (gostima) da kreiraju narudžbe
DROP POLICY IF EXISTS "Gosti mogu kreirati narudzbe" ON orders;
CREATE POLICY "Gosti mogu kreirati narudzbe" ON orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Gosti mogu kreirati stavke narudzbe" ON order_items;
CREATE POLICY "Gosti mogu kreirati stavke narudzbe" ON order_items
  FOR INSERT WITH CHECK (true);

-- Vlasnik vidi sve narudžbe svog restorana
DROP POLICY IF EXISTS "Vlasnik vidi narudzbe" ON orders;
CREATE POLICY "Vlasnik vidi narudzbe" ON orders
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vlasnik vidi stavke narudzbi" ON order_items;
CREATE POLICY "Vlasnik vidi stavke narudzbi" ON order_items
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
  );

-- Vlasnik može update narudžbe (mijenjanje statusa)
DROP POLICY IF EXISTS "Vlasnik azurira narudzbe" ON orders;
CREATE POLICY "Vlasnik azurira narudzbe" ON orders
  FOR UPDATE USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
  );

-- Osvježi schema cache
NOTIFY pgrst, 'reload schema';
