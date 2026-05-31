-- ============================================================
-- Faza 8.5.D — book_spa_appointment() RPC
-- SECURITY DEFINER da dozvolimo anonimni booking
-- ============================================================

DROP FUNCTION IF EXISTS book_spa_appointment(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION book_spa_appointment(
  p_restaurant_id    UUID,
  p_service_id       UUID,
  p_therapist_id     UUID,
  p_spa_room_id      UUID,
  p_date             DATE,
  p_start_time       TIME,
  p_end_time         TIME,
  p_duration_minutes INT,
  p_price            NUMERIC,
  p_guest_name       TEXT,
  p_guest_email      TEXT,
  p_guest_phone      TEXT      DEFAULT NULL,
  p_guest_notes      TEXT      DEFAULT NULL,
  p_payment_method   TEXT      DEFAULT 'cash',
  p_reservation_code TEXT      DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_reservation_id UUID;
  v_guest_id             UUID;
  v_appointment_id       UUID;
  v_service_name         TEXT;
BEGIN
  -- Provjeri da tretman postoji i aktivan je za ovaj restoran
  SELECT name INTO v_service_name
  FROM spa_services
  WHERE id = p_service_id AND restaurant_id = p_restaurant_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Tretman nije pronađen ili nije aktivan.');
  END IF;

  -- Provjeri da terapeut nije zauzet (double-booking prevencija)
  IF p_therapist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM spa_appointments
    WHERE therapist_id     = p_therapist_id
      AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'no_show')
      AND start_time < p_end_time
      AND end_time   > p_start_time
  ) THEN
    RETURN jsonb_build_object('error', 'Terapeut je već zauzet u ovom terminu. Odaberite drugi termin.');
  END IF;

  -- Provjeri da kabina nije zauzeta
  IF p_spa_room_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM spa_appointments
    WHERE spa_room_id      = p_spa_room_id
      AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'no_show')
      AND start_time < p_end_time
      AND end_time   > p_start_time
  ) THEN
    RETURN jsonb_build_object('error', 'Kabina je već zauzeta u ovom terminu. Odaberite drugi termin.');
  END IF;

  -- Poveži sa hotelskom rezervacijom ako je traženo folio plaćanje
  IF p_payment_method = 'folio' AND p_reservation_code IS NOT NULL AND p_reservation_code != '' THEN
    SELECT hr.id, hr.guest_id
    INTO v_hotel_reservation_id, v_guest_id
    FROM hotel_reservations hr
    WHERE hr.restaurant_id = p_restaurant_id
      AND LOWER(LEFT(hr.id::TEXT, 8)) = LOWER(LEFT(REPLACE(p_reservation_code, '-', ''), 8))
      AND hr.status IN ('confirmed', 'checked_in')
    LIMIT 1;

    IF v_hotel_reservation_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Rezervacija nije pronađena. Provjerite kod rezervacije.');
    END IF;
  END IF;

  -- Kreiraj termin
  INSERT INTO spa_appointments (
    restaurant_id, service_id, therapist_id, spa_room_id,
    guest_id, hotel_reservation_id,
    appointment_date, start_time, end_time, duration_minutes,
    external_guest_name, external_guest_phone, external_guest_email,
    guest_notes, price, payment_method, payment_status, status
  ) VALUES (
    p_restaurant_id, p_service_id, p_therapist_id, p_spa_room_id,
    v_guest_id, v_hotel_reservation_id,
    p_date, p_start_time, p_end_time, p_duration_minutes,
    CASE WHEN v_guest_id IS NULL THEN p_guest_name  END,
    CASE WHEN v_guest_id IS NULL THEN p_guest_phone END,
    CASE WHEN v_guest_id IS NULL THEN p_guest_email END,
    p_guest_notes, p_price, p_payment_method, 'pending', 'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'service_name',   v_service_name,
    'date',           p_date,
    'start_time',     p_start_time,
    'end_time',       p_end_time,
    'price',          p_price,
    'payment_method', p_payment_method
  );
END;
$$;

GRANT EXECUTE ON FUNCTION book_spa_appointment(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon;

GRANT EXECUTE ON FUNCTION book_spa_appointment(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
