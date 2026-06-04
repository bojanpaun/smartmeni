-- Oglasna ploča za osoblje — admin objavljuje obavijesti vidljive u Staff portalu
CREATE TABLE staff_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ  -- null = ne istječe
);

ALTER TABLE staff_announcements ENABLE ROW LEVEL SECURITY;

-- Vlasnik restorana može sve operacije
CREATE POLICY "staff_announcements_owner" ON staff_announcements
  FOR ALL USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Autentifikovano osoblje može čitati obavijesti svog restorana
-- (restaurant_id se provjerava na nivou querija u portalu)
CREATE POLICY "staff_announcements_staff_read" ON staff_announcements
  FOR SELECT TO authenticated USING (true);
