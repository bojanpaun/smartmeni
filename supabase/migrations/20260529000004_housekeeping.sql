-- ================================================================
-- Faza 4: Housekeeping modul
-- Tabele: housekeeping_tasks, maintenance_requests
-- Trigger: auto-kreira checkout_clean task pri check-outu
-- ================================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  assigned_to   UUID REFERENCES staff(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES hotel_reservations(id) ON DELETE SET NULL,
  type          TEXT NOT NULL DEFAULT 'stayover_clean',
  -- checkout_clean | stayover_clean | turndown | inspection | deep_clean
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending | in_progress | done | verified
  priority      TEXT NOT NULL DEFAULT 'normal',
  -- low | normal | high | urgent
  notes         TEXT,
  scheduled_for DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  verified_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_id       UUID REFERENCES rooms(id) ON DELETE SET NULL,
  reported_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  category      TEXT DEFAULT 'other',
  -- plumbing | electrical | ac | furniture | internet | other
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  -- open | in_progress | resolved
  priority      TEXT NOT NULL DEFAULT 'normal',
  -- low | normal | high | urgent
  assigned_to   UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── INDEKSI ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hk_tasks_restaurant   ON housekeeping_tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_room         ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_date         ON housekeeping_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status       ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned     ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maint_restaurant      ON maintenance_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_maint_room            ON maintenance_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_maint_status          ON maintenance_requests(status);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE housekeeping_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages housekeeping_tasks"
  ON housekeeping_tasks FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff manages housekeeping_tasks"
  ON housekeeping_tasks FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Owner manages maintenance_requests"
  ON maintenance_requests FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff manages maintenance_requests"
  ON maintenance_requests FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true
  ));

-- ── TRIGGER: auto-kreira checkout_clean task pri check-outu ──────
CREATE OR REPLACE FUNCTION create_checkout_cleaning_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Okida se kada rezervacija prelazi u status 'checked_out'
  IF NEW.status = 'checked_out' AND (OLD.status IS DISTINCT FROM 'checked_out') THEN

    -- Kreira zadatak čišćenja ako soba postoji
    IF NEW.room_id IS NOT NULL THEN
      INSERT INTO housekeeping_tasks (
        restaurant_id, room_id, reservation_id,
        type, status, priority, scheduled_for,
        notes
      ) VALUES (
        NEW.restaurant_id, NEW.room_id, NEW.id,
        'checkout_clean', 'pending', 'high', CURRENT_DATE,
        'Automatski kreiran pri check-outu gosta ' || NEW.guest_name
      );

      -- Postavi sobu na 'cleaning' (Front Desk to radi ručno, ali trigger je backup)
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

-- ── TRIGGER: auto-ažurira soba status kad je zadatak done ────────
CREATE OR REPLACE FUNCTION sync_room_status_on_task_done()
RETURNS TRIGGER AS $$
BEGIN
  -- Kad se checkout_clean ili stayover_clean označi kao 'done' ili 'verified'
  IF NEW.status IN ('done', 'verified')
     AND OLD.status NOT IN ('done', 'verified')
     AND NEW.type IN ('checkout_clean', 'stayover_clean', 'deep_clean') THEN

    -- Postavi sobu na 'available'
    UPDATE rooms SET status = 'available', last_cleaned_at = now()
    WHERE id = NEW.room_id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_room_status_on_clean ON housekeeping_tasks;
CREATE TRIGGER trigger_room_status_on_clean
  AFTER UPDATE ON housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION sync_room_status_on_task_done();
