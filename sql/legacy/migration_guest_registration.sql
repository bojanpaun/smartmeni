-- Dodaj toggle za registraciju gostiju na restaurants tabelu
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS guest_registration_enabled BOOLEAN DEFAULT true;

-- RLS policy za anonimni INSERT u guests (za registraciju gostiju bez naloga)
CREATE POLICY IF NOT EXISTS "Gost se moze registrovati"
  ON guests FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    restaurant_id IN (
      SELECT id FROM restaurants WHERE guest_registration_enabled = true
    )
  );

NOTIFY pgrst, 'reload schema';
