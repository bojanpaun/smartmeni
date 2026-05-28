-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: višestruke smjene po danu

CREATE TABLE IF NOT EXISTS attendance_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  hours_worked DECIMAL(5,2),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_entries_staff ON attendance_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_att_entries_date ON attendance_entries(date);

ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja unosima" ON attendance_entries FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Zaposlenik vidi vlastite unose" ON attendance_entries FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

CREATE POLICY "Zaposlenik kreira vlastiti unos" ON attendance_entries FOR INSERT
  WITH CHECK (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Zaposlenik azurira vlastiti unos" ON attendance_entries FOR UPDATE
  USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid() AND is_active = true));

ALTER PUBLICATION supabase_realtime ADD TABLE attendance_entries;
