-- Dodaj FK constraints na spa_therapist_services ako ne postoje
-- (potrebno za PostgREST join sintaksu u booking stranici)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spa_therapist_services_therapist_id_fkey'
      AND conrelid = 'spa_therapist_services'::regclass
  ) THEN
    ALTER TABLE spa_therapist_services
      ADD CONSTRAINT spa_therapist_services_therapist_id_fkey
      FOREIGN KEY (therapist_id) REFERENCES spa_therapists(id) ON DELETE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spa_therapist_services_service_id_fkey'
      AND conrelid = 'spa_therapist_services'::regclass
  ) THEN
    ALTER TABLE spa_therapist_services
      ADD CONSTRAINT spa_therapist_services_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES spa_services(id) ON DELETE CASCADE;
  END IF;
END;
$$;
