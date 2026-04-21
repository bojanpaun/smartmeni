-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: plate zaposlenih za analitiku troška rada

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS wage_type TEXT DEFAULT 'monthly'
    CHECK (wage_type IN ('hourly', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS wage_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN staff.wage_type IS 'Tip plate: hourly=po satu, weekly=sedmično, monthly=mjesečno';
COMMENT ON COLUMN staff.wage_amount IS 'Iznos plate u EUR za odabrani tip';
