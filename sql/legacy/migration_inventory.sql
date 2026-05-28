-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: Upravljanje zalihama

-- 1. Stavke inventara
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'ostalo',
  unit TEXT DEFAULT 'kom' CHECK (unit IN ('kom', 'kg', 'g', 'l', 'ml', 'pak')),
  quantity DECIMAL(10,3) DEFAULT 0,
  min_quantity DECIMAL(10,3) DEFAULT 0,
  cost_per_unit DECIMAL(10,2),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pokreti zaliha (istorija)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(10,3) NOT NULL,
  quantity_before DECIMAL(10,3),
  quantity_after DECIMAL(10,3),
  note TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'order')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Veza stavki menija i sastojaka (recepture)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  UNIQUE(menu_item_id, inventory_item_id)
);

-- Indeksi
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_restaurant ON inventory_movements(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu_item ON menu_item_ingredients(menu_item_id);

-- RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja inventarom"
  ON inventory_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Vlasnik vidi pokrete"
  ON inventory_movements FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Vlasnik upravlja recepturama"
  ON menu_item_ingredients FOR ALL
  USING (menu_item_id IN (
    SELECT id FROM menu_items WHERE restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  ));

-- Funkcija za automatski odbitak pri narudžbi
CREATE OR REPLACE FUNCTION deduct_inventory_on_order()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
BEGIN
  -- Pokreće se samo kad narudžba pređe u status 'received'
  IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
    -- Za svaku stavku narudžbe nađi recepturu i odbitak
    FOR item IN
      SELECT
        mii.inventory_item_id,
        mii.quantity AS qty_per_portion,
        ii.quantity AS current_qty,
        ii.restaurant_id
      FROM order_items oi
      JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
      JOIN inventory_items ii ON ii.id = mii.inventory_item_id
      WHERE oi.order_id = NEW.id
    LOOP
      -- Ažuriraj količinu
      UPDATE inventory_items
      SET
        quantity = GREATEST(0, quantity - item.qty_per_portion),
        updated_at = NOW()
      WHERE id = item.inventory_item_id;

      -- Zabijeleži pokret
      INSERT INTO inventory_movements (
        restaurant_id, item_id, type, quantity,
        quantity_before, quantity_after, source, order_id, note
      ) VALUES (
        item.restaurant_id,
        item.inventory_item_id,
        'out',
        item.qty_per_portion,
        item.current_qty,
        GREATEST(0, item.current_qty - item.qty_per_portion),
        'order',
        NEW.id,
        'Automatski odbitak — narudžba #' || NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na orders tabeli
DROP TRIGGER IF EXISTS trigger_deduct_inventory ON orders;
CREATE TRIGGER trigger_deduct_inventory
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order();

COMMENT ON TABLE inventory_items IS 'Stavke inventara — namirnice i gotovi proizvodi';
COMMENT ON TABLE inventory_movements IS 'Istorija pokreta zaliha — ulazi, izlazi i korekcije';
COMMENT ON TABLE menu_item_ingredients IS 'Recepture — veza stavki menija i sastojaka inventara';
