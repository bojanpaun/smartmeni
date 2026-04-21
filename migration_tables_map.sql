-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: Mapa stolova

CREATE TABLE IF NOT EXISTS tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  number INTEGER NOT NULL,
  label TEXT,
  x FLOAT DEFAULT 50,
  y FLOAT DEFAULT 50,
  width FLOAT DEFAULT 80,
  height FLOAT DEFAULT 80,
  shape TEXT DEFAULT 'rect' CHECK (shape IN ('rect', 'circle')),
  seats INTEGER DEFAULT 4,
  status TEXT DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'calling')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index za brži upit po restoranu
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON tables(restaurant_id);

-- RLS politike
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage tables"
  ON tables FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read tables"
  ON tables FOR SELECT
  USING (true);

-- Komentar
COMMENT ON TABLE tables IS 'Interaktivna mapa stolova restorana — pozicije, oblici i status';
