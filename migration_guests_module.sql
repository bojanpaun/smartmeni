-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor

-- 1. Tabela gostiju
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Osnovni podaci
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  avatar_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'regular' CHECK (status IN ('regular', 'vip', 'blacklist', 'pending')),
  blacklist_reason TEXT,
  
  -- Statistike (cache — ažuriraju se automatski)
  total_visits INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  
  -- Nalog (ako se registrovao)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Meta
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela posjeta
CREATE TABLE IF NOT EXISTS guest_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  table_number TEXT,
  party_size INTEGER DEFAULT 1,
  visit_type TEXT DEFAULT 'walk_in' CHECK (visit_type IN ('walk_in', 'reservation', 'online')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'no_show', 'unpaid')),
  
  -- Veze
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  
  amount_spent NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Storage bucket za avatare gostiju
INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-avatars', 'guest-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policy
CREATE POLICY "Guest avatars su javni"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guest-avatars');

CREATE POLICY "Vlasnik upravlja guest avatarima"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'guest-avatars' AND
    auth.uid() IN (
      SELECT user_id FROM restaurants WHERE id::text = (storage.foldername(name))[1]
    )
  );

-- 5. RLS
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja gostima"
  ON guests FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Vlasnik upravlja posjetama"
  ON guest_visits FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Gost vidi vlastiti profil
CREATE POLICY "Gost vidi vlastiti profil"
  ON guests FOR SELECT
  USING (user_id = auth.uid());

-- 6. Trigger za ažuriranje updated_at
CREATE OR REPLACE FUNCTION update_guest_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_guest_updated_at();

-- 7. Funkcija za ažuriranje statistika gosta nakon svake posjete
CREATE OR REPLACE FUNCTION refresh_guest_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE guests SET
    total_visits = (SELECT COUNT(*) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status NOT IN ('cancelled')),
    total_spent  = (SELECT COALESCE(SUM(amount_spent), 0) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status = 'completed'),
    no_show_count = (SELECT COUNT(*) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status IN ('no_show', 'unpaid'))
  WHERE id = COALESCE(NEW.guest_id, OLD.guest_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guest_visits_stats
  AFTER INSERT OR UPDATE OR DELETE ON guest_visits
  FOR EACH ROW EXECUTE FUNCTION refresh_guest_stats();

NOTIFY pgrst, 'reload schema';
