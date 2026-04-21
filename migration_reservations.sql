-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: is_resolved za waiter_requests + tabela rezervacija

-- 1. Dodati is_resolved u waiter_requests (ako već nije)
ALTER TABLE waiter_requests
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- 2. Kreirati tabelu rezervacija
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  table_number INTEGER,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  guest_email TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  guests_count INTEGER DEFAULT 2,
  note TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  source TEXT DEFAULT 'admin'
    CHECK (source IN ('admin', 'online')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index za brže upite
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);

-- RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja rezervacijama"
  ON reservations FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Osoblje vidi rezervacije"
  ON reservations FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Javno kreiranje online rezervacija"
  ON reservations FOR INSERT
  WITH CHECK (source = 'online');

-- 3. Dodati online_reservations toggle na restaurants tabelu
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS online_reservations BOOLEAN DEFAULT false;

COMMENT ON COLUMN restaurants.online_reservations IS
  'Kada je true, gosti mogu slati zahtjeve za rezervaciju online. Admin ih odobrava.';

COMMENT ON TABLE reservations IS
  'Rezervacije stolova — admin kreira direktno, gosti šalju zahtjeve (ako je online_reservations=true)';
