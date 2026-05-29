-- ================================================================
-- Faza 3: Booking Engine
-- Tabele: rate_plans, seasonal_rates, room_availability, booking_payments
-- Funkcija: get_available_rooms()
-- ================================================================

-- Cjenovni planovi
CREATE TABLE IF NOT EXISTS rate_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  price_per_night      NUMERIC(10,2) NOT NULL,
  min_stay             INT DEFAULT 1,
  max_stay             INT,
  cancellation_policy  TEXT DEFAULT 'flexible',
  -- flexible | moderate | strict | non_refundable
  advance_booking_days INT,
  is_active            BOOLEAN DEFAULT true,
  sort_order           INT DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Sezonske cijene (override base_price za period)
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id    UUID REFERENCES rate_plans(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  label           TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  price_per_night NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Dostupnost po tipu sobe i datumu
CREATE TABLE IF NOT EXISTS room_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_type_id    UUID REFERENCES room_types(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  total_rooms     INT NOT NULL DEFAULT 0,
  available_rooms INT NOT NULL DEFAULT 0,
  stop_sell       BOOLEAN DEFAULT false,
  UNIQUE(room_type_id, date)
);

-- PayPal plaćanja za online rezervacije
CREATE TABLE IF NOT EXISTS booking_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  restaurant_id     UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  paypal_order_id   TEXT,
  paypal_capture_id TEXT,
  amount            NUMERIC(10,2),
  currency          TEXT DEFAULT 'EUR',
  status            TEXT DEFAULT 'pending',
  -- pending | completed | refunded | failed
  payload           JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Veza između rezervacije i cjenovnog plana
ALTER TABLE hotel_reservations
  ADD COLUMN IF NOT EXISTS rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE SET NULL;

-- ── INDEKSI ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rate_plans_restaurant  ON rate_plans(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_plan    ON seasonal_rates(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_dates   ON seasonal_rates(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_room_avail_type_date   ON room_availability(room_type_id, date);
CREATE INDEX IF NOT EXISTS idx_room_avail_restaurant  ON room_availability(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_res   ON booking_payments(reservation_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE rate_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments  ENABLE ROW LEVEL SECURITY;

-- rate_plans
CREATE POLICY "Owner manages rate_plans"
  ON rate_plans FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Public reads active rate_plans"
  ON rate_plans FOR SELECT
  USING (is_active = true);

-- seasonal_rates
CREATE POLICY "Owner manages seasonal_rates"
  ON seasonal_rates FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Public reads seasonal_rates"
  ON seasonal_rates FOR SELECT
  USING (true);

-- room_availability
CREATE POLICY "Owner manages room_availability"
  ON room_availability FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Public reads room_availability"
  ON room_availability FOR SELECT
  USING (true);

-- booking_payments: samo vlasnik
CREATE POLICY "Owner manages booking_payments"
  ON booking_payments FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Javno čitanje room_types (potrebno za booking stranicu)
CREATE POLICY "Public reads active room_types"
  ON room_types FOR SELECT
  USING (is_active = true);

-- ── FUNKCIJA: get_available_rooms ─────────────────────────────────
-- Vraća tipove soba koji su slobodni za traženi period.
-- Koristi room_availability ako postoji, inače broji sobe iz rooms tabele.
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
  base_price      NUMERIC,
  amenities       JSONB,
  images          JSONB,
  nights          INT,
  price_per_night NUMERIC,
  total_price     NUMERIC,
  available_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nights INT := (p_check_out - p_check_in);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      rt.id               AS rt_id,
      rt.name             AS rt_name,
      rt.description      AS rt_description,
      rt.max_occupancy    AS rt_max_occupancy,
      rt.base_price       AS rt_base_price,
      rt.amenities        AS rt_amenities,
      rt.images           AS rt_images,
      rt.sort_order       AS rt_sort_order,
      COALESCE(
        -- Ako postoje zapisi u room_availability, uzmi minimum slobodnih
        (SELECT MIN(ra.available_rooms)
         FROM room_availability ra
         WHERE ra.room_type_id = rt.id
           AND ra.date >= p_check_in
           AND ra.date < p_check_out),
        -- Inače broji sobe koje nemaju aktivan overlap
        (SELECT COUNT(*)::INT
         FROM rooms r
         WHERE r.room_type_id = rt.id
           AND r.status = 'available'
           AND NOT EXISTS (
             SELECT 1 FROM hotel_reservations hr
             WHERE hr.room_id = r.id
               AND hr.status NOT IN ('cancelled', 'no_show')
               AND hr.check_in_date < p_check_out
               AND hr.check_out_date > p_check_in
           )
        )
      ) AS cnt
    FROM room_types rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      AND rt.max_occupancy >= p_adults
      -- Nema stop_sell ni za jedan dan u periodu
      AND NOT EXISTS (
        SELECT 1 FROM room_availability ra
        WHERE ra.room_type_id = rt.id
          AND ra.date >= p_check_in
          AND ra.date < p_check_out
          AND ra.stop_sell = true
      )
  )
  SELECT
    c.rt_id,
    c.rt_name,
    c.rt_description,
    c.rt_max_occupancy,
    c.rt_base_price,
    c.rt_amenities,
    c.rt_images,
    v_nights,
    c.rt_base_price,
    (c.rt_base_price * v_nights),
    c.cnt::INT
  FROM candidates c
  WHERE c.cnt > 0
  ORDER BY c.rt_sort_order, c.rt_base_price;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, INT) TO anon;
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, INT) TO authenticated;
