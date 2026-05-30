-- ============================================================
-- Faza 3d — Availability Engine
-- room_availability tabela, get_available_rooms() RPC,
-- trigeri za automatsko ažuriranje pri promjenama rezervacija
-- ============================================================

-- ── 1. Tabela room_availability ──────────────────────────────

CREATE TABLE IF NOT EXISTS room_availability (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id   UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  total_rooms    INT  NOT NULL DEFAULT 0,
  available_rooms INT NOT NULL DEFAULT 0,
  stop_sell      BOOLEAN DEFAULT false,
  UNIQUE(room_type_id, date)
);

ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_availability_auth_read" ON room_availability;
CREATE POLICY "room_availability_auth_read"
ON room_availability FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "room_availability_service_write" ON room_availability;
CREATE POLICY "room_availability_service_write"
ON room_availability FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_room_availability_lookup
ON room_availability(room_type_id, date, available_rooms)
WHERE stop_sell = false;

-- ── 2. Početna popunjenost za postojeće tipove soba (730 dana) ──

INSERT INTO room_availability (room_type_id, restaurant_id, date, total_rooms, available_rooms)
SELECT
  rt.id,
  rt.restaurant_id,
  d::DATE,
  COALESCE(rc.cnt, 0),
  COALESCE(rc.cnt, 0)
FROM room_types rt
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '730 days', '1 day') d
LEFT JOIN (
  SELECT room_type_id, COUNT(*) AS cnt
  FROM rooms
  WHERE status != 'maintenance'
  GROUP BY room_type_id
) rc ON rc.room_type_id = rt.id
ON CONFLICT (room_type_id, date) DO NOTHING;

-- ── 3. Uskladi s postojećim potvrđenim rezervacijama ──────────

WITH reservation_dates AS (
  SELECT
    hr.room_type_id,
    generate_series(hr.check_in_date, hr.check_out_date - INTERVAL '1 day', '1 day')::DATE AS res_date
  FROM hotel_reservations hr
  WHERE hr.status IN ('confirmed', 'checked_in')
    AND hr.room_type_id IS NOT NULL
    AND hr.check_out_date > CURRENT_DATE
),
date_counts AS (
  SELECT room_type_id, res_date, COUNT(*) AS n
  FROM reservation_dates
  GROUP BY room_type_id, res_date
)
UPDATE room_availability ra
SET available_rooms = GREATEST(0, ra.available_rooms - dc.n::INT)
FROM date_counts dc
WHERE ra.room_type_id = dc.room_type_id
  AND ra.date = dc.res_date;

-- ── 4. get_available_rooms() RPC ─────────────────────────────

-- Drop first — CREATE OR REPLACE ne može promijeniti return tip
DROP FUNCTION IF EXISTS get_available_rooms(UUID, DATE, DATE, INT);

CREATE OR REPLACE FUNCTION get_available_rooms(
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE,
  p_adults        INT DEFAULT 1
)
RETURNS TABLE (
  room_type_id    UUID,
  name            TEXT,
  description     TEXT,
  max_occupancy   INT,
  amenities       JSONB,
  images          JSONB,
  available_count INT,
  price_per_night NUMERIC,
  total_price     NUMERIC,
  nights          INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
BEGIN
  IF v_nights <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH best_rate AS (
    -- Najjeftiniji aktivni cjenovni plan po tipu sobe
    SELECT DISTINCT ON (room_type_id)
      room_type_id,
      price_per_night,
      min_stay
    FROM rate_plans
    WHERE restaurant_id = p_restaurant_id
      AND is_active = true
    ORDER BY room_type_id, price_per_night ASC
  )
  SELECT
    rt.id,
    rt.name,
    rt.description,
    rt.max_occupancy,
    COALESCE(rt.amenities, '[]'::JSONB),
    COALESCE(rt.images,    '[]'::JSONB),
    MIN(ra.available_rooms)::INT,
    br.price_per_night,
    br.price_per_night * v_nights,
    v_nights
  FROM room_types rt
  JOIN room_availability ra ON ra.room_type_id = rt.id
  JOIN best_rate br ON br.room_type_id = rt.id
  WHERE rt.restaurant_id  = p_restaurant_id
    AND rt.max_occupancy  >= p_adults
    AND rt.is_active      = true
    AND ra.date           >= p_check_in
    AND ra.date           < p_check_out
    AND ra.available_rooms > 0
    AND ra.stop_sell      = false
    AND br.min_stay       <= v_nights
  GROUP BY rt.id, rt.name, rt.description, rt.max_occupancy,
           rt.amenities, rt.images, br.price_per_night
  HAVING COUNT(DISTINCT ra.date) = v_nights
  ORDER BY br.price_per_night ASC;
END;
$$;

-- BookingPage je javna stranica — dozvoli anonimni poziv
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, INT) TO authenticated;

-- ── 5. Triger: promjene rezervacija → ažuriraj dostupnost ────

CREATE OR REPLACE FUNCTION trg_fn_reservation_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('confirmed', 'checked_in') AND NEW.room_type_id IS NOT NULL THEN
      UPDATE room_availability
      SET available_rooms = GREATEST(0, available_rooms - 1)
      WHERE room_type_id = NEW.room_type_id
        AND date >= NEW.check_in_date
        AND date <  NEW.check_out_date;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Bila aktivna → više nije (otkazano / no_show / checked_out)
    IF OLD.status IN ('confirmed', 'checked_in')
       AND NEW.status NOT IN ('confirmed', 'checked_in')
    THEN
      UPDATE room_availability
      SET available_rooms = LEAST(total_rooms, available_rooms + 1)
      WHERE room_type_id = OLD.room_type_id
        AND date >= OLD.check_in_date
        AND date <  OLD.check_out_date;
    END IF;

    -- Nije bila aktivna → sada jest
    IF OLD.status NOT IN ('confirmed', 'checked_in')
       AND NEW.status IN ('confirmed', 'checked_in')
    THEN
      UPDATE room_availability
      SET available_rooms = GREATEST(0, available_rooms - 1)
      WHERE room_type_id = NEW.room_type_id
        AND date >= NEW.check_in_date
        AND date <  NEW.check_out_date;
    END IF;

    -- Ostala aktivna ali promijenili se datumi ili tip sobe
    IF OLD.status IN ('confirmed', 'checked_in')
       AND NEW.status IN ('confirmed', 'checked_in')
       AND (
         OLD.check_in_date  IS DISTINCT FROM NEW.check_in_date  OR
         OLD.check_out_date IS DISTINCT FROM NEW.check_out_date OR
         OLD.room_type_id   IS DISTINCT FROM NEW.room_type_id
       )
    THEN
      UPDATE room_availability
      SET available_rooms = LEAST(total_rooms, available_rooms + 1)
      WHERE room_type_id = OLD.room_type_id
        AND date >= OLD.check_in_date
        AND date <  OLD.check_out_date;

      UPDATE room_availability
      SET available_rooms = GREATEST(0, available_rooms - 1)
      WHERE room_type_id = NEW.room_type_id
        AND date >= NEW.check_in_date
        AND date <  NEW.check_out_date;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('confirmed', 'checked_in') AND OLD.room_type_id IS NOT NULL THEN
      UPDATE room_availability
      SET available_rooms = LEAST(total_rooms, available_rooms + 1)
      WHERE room_type_id = OLD.room_type_id
        AND date >= OLD.check_in_date
        AND date <  OLD.check_out_date;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_availability ON hotel_reservations;
CREATE TRIGGER trg_reservation_availability
AFTER INSERT OR UPDATE OR DELETE ON hotel_reservations
FOR EACH ROW EXECUTE FUNCTION trg_fn_reservation_availability();

-- ── 6. Triger: novi tip sobe → automatski popuni 730 dana ────

CREATE OR REPLACE FUNCTION trg_fn_new_room_type_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO room_availability (room_type_id, restaurant_id, date, total_rooms, available_rooms)
  SELECT
    NEW.id,
    NEW.restaurant_id,
    d::DATE,
    0,
    0
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '730 days', '1 day') d
  ON CONFLICT (room_type_id, date) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_type_availability ON room_types;
CREATE TRIGGER trg_room_type_availability
AFTER INSERT ON room_types
FOR EACH ROW EXECUTE FUNCTION trg_fn_new_room_type_availability();

-- ── 7. Triger: nova/obrisana soba → ažuriraj total_rooms ─────

CREATE OR REPLACE FUNCTION trg_fn_room_count_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status != 'maintenance' THEN
    UPDATE room_availability
    SET total_rooms     = total_rooms + 1,
        available_rooms = available_rooms + 1
    WHERE room_type_id = NEW.room_type_id;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status != 'maintenance' THEN
    UPDATE room_availability
    SET total_rooms     = GREATEST(0, total_rooms - 1),
        available_rooms = GREATEST(0, available_rooms - 1)
    WHERE room_type_id = OLD.room_type_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Soba ušla u maintenance → smanji (samo od danas)
    IF OLD.status != 'maintenance' AND NEW.status = 'maintenance' THEN
      UPDATE room_availability
      SET total_rooms     = GREATEST(0, total_rooms - 1),
          available_rooms = GREATEST(0, available_rooms - 1)
      WHERE room_type_id = NEW.room_type_id AND date >= CURRENT_DATE;
    END IF;
    -- Soba izašla iz maintenance → povećaj (samo od danas)
    IF OLD.status = 'maintenance' AND NEW.status != 'maintenance' THEN
      UPDATE room_availability
      SET total_rooms     = total_rooms + 1,
          available_rooms = available_rooms + 1
      WHERE room_type_id = NEW.room_type_id AND date >= CURRENT_DATE;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_room_count ON rooms;
CREATE TRIGGER trg_room_count
AFTER INSERT OR UPDATE OR DELETE ON rooms
FOR EACH ROW EXECUTE FUNCTION trg_fn_room_count_availability();
