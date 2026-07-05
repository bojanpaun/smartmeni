-- ============================================================================
-- DEMO guest portal — anon RPC za auto-login u hotelski Guest App (/demo/guest)
-- ----------------------------------------------------------------------------
-- Problem: hotelski Guest App traži rezervacijski kod + email. U demu prospekt nema
-- kod, pa portal ostaje na login ekranu. Ovaj RPC vraća AKTIVNU (checked_in) prijavu
-- demo tenanta u ISTOM obliku kao `get_guest_reservation`, pa GuestAppPage može
-- auto-login-ovati bez traženja koda.
--
-- SIGURNOST: gejtovano na `restaurants.is_demo = true` (JOIN) — za NE-demo tenant
-- vraća 0 redova, pa se ne može zloupotrijebiti za čitanje pravih rezervacija. Vraća
-- samo demo podatke (Ana Nikolić, seedovana) koji su ionako namjerno javni.
-- Isti obrazac kao ostali anon guest RPC-ovi (SECURITY DEFINER + GRANT TO anon).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_demo_guest_reservation(p_restaurant_id UUID)
RETURNS TABLE (
  id              UUID,
  guest_name      TEXT,
  guest_email     TEXT,
  guest_phone     TEXT,
  check_in_date   DATE,
  check_out_date  DATE,
  adults          INT,
  children        INT,
  room_type_name  TEXT,
  room_number     TEXT,
  status          TEXT,
  special_requests TEXT,
  total_amount    NUMERIC,
  paid_amount     NUMERIC,
  payment_status  TEXT,
  rate_per_night  NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id,
    r.guest_name,
    r.guest_email,
    r.guest_phone,
    r.check_in_date,
    r.check_out_date,
    r.adults,
    r.children,
    rt.name  AS room_type_name,
    rm.room_number,
    r.status,
    r.special_requests,
    r.total_amount,
    r.paid_amount,
    r.payment_status,
    r.rate_per_night
  FROM hotel_reservations r
  JOIN restaurants res ON res.id = r.restaurant_id AND res.is_demo = true   -- gejt: samo demo tenant
  LEFT JOIN room_types rt ON r.room_type_id = rt.id
  LEFT JOIN rooms       rm ON r.room_id       = rm.id
  WHERE r.restaurant_id = p_restaurant_id
    AND r.status = 'checked_in'
  ORDER BY r.check_in_date DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_demo_guest_reservation(UUID) IS
  'Vraća aktivnu (checked_in) prijavu DEMO tenanta za auto-login hotelskog Guest App-a. Gejtovano na is_demo (ne-demo → 0 redova).';

GRANT EXECUTE ON FUNCTION get_demo_guest_reservation(UUID) TO anon, authenticated;
