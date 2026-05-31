-- Dodaj FK constraint na staff_id ako ne postoji
-- (potrebno za PostgREST staff!staff_id join sintaksu)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spa_therapists_staff_id_fkey'
      AND conrelid = 'spa_therapists'::regclass
  ) THEN
    ALTER TABLE spa_therapists
      ADD CONSTRAINT spa_therapists_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Dodaj FK constraint na restaurant_id ako ne postoji
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spa_therapists_restaurant_id_fkey'
      AND conrelid = 'spa_therapists'::regclass
  ) THEN
    ALTER TABLE spa_therapists
      ADD CONSTRAINT spa_therapists_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Anon SELECT politika za spa_therapists (javna booking stranica /:slug/spa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spa_therapists'
      AND policyname = 'spa_public_read_therapists'
  ) THEN
    EXECUTE 'CREATE POLICY "spa_public_read_therapists" ON spa_therapists FOR SELECT TO anon USING (is_available = true)';
  END IF;
END;
$$;

-- Anon SELECT politika za spa_therapist_services (javna booking stranica)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spa_therapist_services'
      AND policyname = 'spa_public_read_therapist_services'
  ) THEN
    EXECUTE 'CREATE POLICY "spa_public_read_therapist_services" ON spa_therapist_services FOR SELECT TO anon USING (true)';
  END IF;
END;
$$;
