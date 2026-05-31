-- Dodaj FK constraints i kolone koje možda nedostaju u housekeeping_tasks
-- (tabele kreirane ručno bez FK-ova → PostgREST join vraća 400)

-- ── housekeeping_tasks: kolone ───────────────────────────────────
ALTER TABLE housekeeping_tasks
  ADD COLUMN IF NOT EXISTS reservation_id UUID,
  ADD COLUMN IF NOT EXISTS verified_by    UUID,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

-- ── housekeeping_tasks: FK constraints ──────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'housekeeping_tasks_room_id_fkey'
      AND conrelid = 'housekeeping_tasks'::regclass
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'housekeeping_tasks_assigned_to_fkey'
      AND conrelid = 'housekeeping_tasks'::regclass
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'housekeeping_tasks_restaurant_id_fkey'
      AND conrelid = 'housekeeping_tasks'::regclass
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'housekeeping_tasks_reservation_id_fkey'
      AND conrelid = 'housekeeping_tasks'::regclass
  ) THEN
    ALTER TABLE housekeeping_tasks
      ADD CONSTRAINT housekeeping_tasks_reservation_id_fkey
      FOREIGN KEY (reservation_id) REFERENCES hotel_reservations(id) ON DELETE SET NULL;
  END IF;
END; $$;

-- ── maintenance_requests: FK constraints ────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'maintenance_requests_room_id_fkey'
      AND conrelid = 'maintenance_requests'::regclass
  ) THEN
    ALTER TABLE maintenance_requests
      ADD CONSTRAINT maintenance_requests_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'maintenance_requests_reported_by_fkey'
      AND conrelid = 'maintenance_requests'::regclass
  ) THEN
    ALTER TABLE maintenance_requests
      ADD CONSTRAINT maintenance_requests_reported_by_fkey
      FOREIGN KEY (reported_by) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'maintenance_requests_assigned_to_fkey'
      AND conrelid = 'maintenance_requests'::regclass
  ) THEN
    ALTER TABLE maintenance_requests
      ADD CONSTRAINT maintenance_requests_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'maintenance_requests_restaurant_id_fkey'
      AND conrelid = 'maintenance_requests'::regclass
  ) THEN
    ALTER TABLE maintenance_requests
      ADD CONSTRAINT maintenance_requests_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;
  END IF;
END; $$;

-- ── Obnovi trigger funkciju (idempotentno) ───────────────────────
CREATE OR REPLACE FUNCTION create_checkout_cleaning_task()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_out' AND (OLD.status IS DISTINCT FROM 'checked_out') THEN
    IF NEW.room_id IS NOT NULL THEN
      INSERT INTO housekeeping_tasks (
        restaurant_id, room_id, reservation_id,
        type, status, priority, scheduled_for, notes
      ) VALUES (
        NEW.restaurant_id, NEW.room_id, NEW.id,
        'checkout_clean', 'pending', 'high', CURRENT_DATE,
        'Automatski kreiran pri check-outu gosta ' || COALESCE(NEW.guest_name, '')
      );
      UPDATE rooms SET status = 'cleaning' WHERE id = NEW.room_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_checkout_cleaning ON hotel_reservations;
CREATE TRIGGER trigger_checkout_cleaning
  AFTER UPDATE ON hotel_reservations
  FOR EACH ROW EXECUTE FUNCTION create_checkout_cleaning_task();
