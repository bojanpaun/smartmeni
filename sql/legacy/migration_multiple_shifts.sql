-- Omogućava više smjena po zaposleniku po danu
-- Uklanja unique constraint koji sprečava višestruke smjene

-- 1. Ukloni stari unique constraint (ako postoji)
ALTER TABLE work_schedules DROP CONSTRAINT IF EXISTS work_schedules_staff_id_date_key;
ALTER TABLE work_schedules DROP CONSTRAINT IF EXISTS work_schedules_staff_id_date_unique;

-- 2. Provjeri i ukloni sve unique indexe na staff_id+date
DO $$
DECLARE
  idx TEXT;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'work_schedules'
      AND indexdef LIKE '%staff_id%date%'
      AND indexdef LIKE '%UNIQUE%'
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || idx;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
