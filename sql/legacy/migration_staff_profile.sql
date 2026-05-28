-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Prošireni profil zaposlenika

ALTER TABLE staff
  -- Osnovne informacije
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,

  -- Kontakt za hitne slučajeve
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,

  -- Zaposlenje
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,

  -- Finansije
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,

  -- Godišnji odmor
  ADD COLUMN IF NOT EXISTS vacation_days_total INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vacation_days_used INTEGER DEFAULT 0;

-- Historija zaposlenja (odvojena tabela)
CREATE TABLE IF NOT EXISTS staff_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'hired', 'promoted', 'wage_change', 'position_change', 'warning', 'note', 'terminated'
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  event_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Odsustva (bolovanje, neplaćeno, godišnji)
CREATE TABLE IF NOT EXISTS staff_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  absence_type TEXT NOT NULL, -- 'vacation', 'sick', 'unpaid', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER,
  notes TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS za staff_history
ALTER TABLE staff_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vlasnik upravlja historijom" ON staff_history
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- RLS za staff_absences  
ALTER TABLE staff_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vlasnik upravlja odsustvima" ON staff_absences
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
