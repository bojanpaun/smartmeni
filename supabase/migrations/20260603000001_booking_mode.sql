-- Booking mode: 'immediate' (odmah confirmed) | 'manual' (admin odobrava)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'immediate';

-- Ažurirati create_booking_direct da prima p_status parametar
-- (podržava i 'inquiry' za manual mode)
DROP FUNCTION IF EXISTS create_booking_direct(UUID,UUID,UUID,TEXT,DATE,DATE,INT,INT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC);

CREATE OR REPLACE FUNCTION create_booking_direct(
  p_restaurant_id    UUID,
  p_room_type_id     UUID,
  p_rate_plan_id     UUID,
  p_package_name     TEXT,
  p_check_in         DATE,
  p_check_out        DATE,
  p_adults           INT,
  p_children         INT,
  p_guest_name       TEXT,
  p_guest_email      TEXT,
  p_guest_phone      TEXT,
  p_special_requests TEXT,
  p_price_per_night  NUMERIC,
  p_total_amount     NUMERIC,
  p_status           TEXT DEFAULT 'confirmed'
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
    p_status, 'pending', 'online'
  )
  RETURNING id INTO v_res_id;

  -- Smanji dostupnost samo za confirmed rezervacije (ne za inquiry)
  IF p_status = 'confirmed' THEN
    UPDATE room_availability
    SET available_rooms = GREATEST(0, available_rooms - 1)
    WHERE room_type_id = p_room_type_id
      AND date >= p_check_in
      AND date < p_check_out;
  END IF;

  RETURN json_build_object(
    'reservation_id',  v_res_id,
    'guest_name',      p_guest_name,
    'guest_email',     p_guest_email,
    'room_type_name',  v_room_name,
    'check_in',        p_check_in::text,
    'check_out',       p_check_out::text,
    'status',          p_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking_direct(UUID,UUID,UUID,TEXT,DATE,DATE,INT,INT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_booking_direct(UUID,UUID,UUID,TEXT,DATE,DATE,INT,INT,TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO authenticated;
