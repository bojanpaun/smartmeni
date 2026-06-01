-- A) guests: dodaj nedostajuće kolone
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS name            TEXT,
  ADD COLUMN IF NOT EXISTS nationality     TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS vip_status      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_visit_at   TIMESTAMPTZ;

-- RLS na guests
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages guests" ON guests;
CREATE POLICY "Owner manages guests" ON guests FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Staff reads guests" ON guests;
CREATE POLICY "Staff reads guests" ON guests FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- B) rate_plans: payment_type
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'online';
DO $$ BEGIN
  ALTER TABLE rate_plans ADD CONSTRAINT chk_rate_plan_payment_type CHECK (payment_type IN ('online','on_arrival'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- C) hotel_reservations: package_name
ALTER TABLE hotel_reservations ADD COLUMN IF NOT EXISTS package_name TEXT;

-- D) Update get_room_packages — dodati payment_type u return
DROP FUNCTION IF EXISTS get_room_packages(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_room_packages(
  p_room_type_id  UUID,
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE
)
RETURNS TABLE (
  rate_plan_id        UUID,
  plan_name           TEXT,
  plan_description    TEXT,
  price_per_night     NUMERIC,
  total_price         NUMERIC,
  nights              INT,
  cancellation_policy TEXT,
  min_stay            INT,
  payment_type        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
  v_mult   NUMERIC;
BEGIN
  SELECT COALESCE(
    (SELECT rp0.multiplier
     FROM rate_plans rp0
     WHERE rp0.restaurant_id = p_restaurant_id
       AND rp0.plan_type     = 'seasonal'
       AND rp0.is_active     = true
       AND (rp0.applies_from  IS NULL OR rp0.applies_from  <= p_check_in)
       AND (rp0.applies_until IS NULL OR rp0.applies_until >= p_check_out)
     ORDER BY rp0.multiplier DESC
     LIMIT 1),
    1.0
  ) INTO v_mult;

  RETURN QUERY
  SELECT
    rp.id,
    rp.name,
    rp.description,
    ROUND(rp.price_per_night * v_mult, 2),
    ROUND(rp.price_per_night * v_mult * v_nights, 2),
    v_nights,
    rp.cancellation_policy,
    rp.min_stay,
    rp.payment_type
  FROM rate_plans rp
  WHERE rp.room_type_id  = p_room_type_id
    AND rp.restaurant_id = p_restaurant_id
    AND rp.plan_type     = 'package'
    AND rp.is_active     = true
    AND rp.min_stay      <= v_nights
  ORDER BY rp.price_per_night ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO authenticated;

-- E) Trigger: auto-create guest on hotel_reservations INSERT
CREATE OR REPLACE FUNCTION trg_fn_auto_create_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gid UUID;
BEGIN
  IF NEW.guest_id IS NULL AND NEW.guest_email IS NOT NULL AND NEW.guest_email <> '' THEN
    SELECT id INTO v_gid FROM guests
    WHERE restaurant_id = NEW.restaurant_id AND lower(email) = lower(NEW.guest_email)
    LIMIT 1;

    IF v_gid IS NULL THEN
      INSERT INTO guests (restaurant_id, name, email, phone)
      VALUES (NEW.restaurant_id, NEW.guest_name, lower(NEW.guest_email), NEW.guest_phone)
      RETURNING id INTO v_gid;
    ELSE
      UPDATE guests SET last_visit_at = now(),
        name  = COALESCE(NULLIF(name,''),  NEW.guest_name),
        phone = COALESCE(phone, NEW.guest_phone)
      WHERE id = v_gid;
    END IF;

    NEW.guest_id := v_gid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotel_reservation_auto_guest ON hotel_reservations;
CREATE TRIGGER trg_hotel_reservation_auto_guest
  BEFORE INSERT ON hotel_reservations
  FOR EACH ROW EXECUTE FUNCTION trg_fn_auto_create_guest();

-- F) create_booking_direct RPC (on_arrival plaćanje)
CREATE OR REPLACE FUNCTION create_booking_direct(
  p_restaurant_id   UUID,
  p_room_type_id    UUID,
  p_rate_plan_id    UUID,
  p_package_name    TEXT,
  p_check_in        DATE,
  p_check_out       DATE,
  p_adults          INT,
  p_children        INT,
  p_guest_name      TEXT,
  p_guest_email     TEXT,
  p_guest_phone     TEXT,
  p_special_requests TEXT,
  p_price_per_night NUMERIC,
  p_total_amount    NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res_id    UUID;
  v_room_name TEXT;
BEGIN
  SELECT name INTO v_room_name FROM room_types WHERE id = p_room_type_id;

  INSERT INTO hotel_reservations (
    restaurant_id, room_type_id, rate_plan_id, package_name,
    check_in_date, check_out_date, adults, children,
    guest_name, guest_email, guest_phone, special_requests,
    rate_per_night, total_amount,
    status, payment_status, source
  ) VALUES (
    p_restaurant_id, p_room_type_id, p_rate_plan_id, p_package_name,
    p_check_in, p_check_out, p_adults, p_children,
    p_guest_name, p_guest_email, p_guest_phone, p_special_requests,
    p_price_per_night, p_total_amount,
    'confirmed', 'pending', 'online'
  )
  RETURNING id INTO v_res_id;

  UPDATE room_availability
  SET available_rooms = GREATEST(0, available_rooms - 1)
  WHERE room_type_id = p_room_type_id
    AND date >= p_check_in
    AND date < p_check_out;

  RETURN json_build_object(
    'reservation_id',  v_res_id,
    'guest_name',      p_guest_name,
    'guest_email',     p_guest_email,
    'room_type_name',  v_room_name,
    'check_in',        p_check_in::text,
    'check_out',       p_check_out::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking_direct(UUID,UUID,UUID,TEXT,DATE,DATE,INT,INT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION create_booking_direct(UUID,UUID,UUID,TEXT,DATE,DATE,INT,INT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC) TO authenticated;
