-- Guest requests: gost šalje zahtjeve recepciji iz Guest App
CREATE TABLE IF NOT EXISTS guest_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES hotel_reservations(id) ON DELETE CASCADE NOT NULL,
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  category       TEXT NOT NULL DEFAULT 'other',
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | resolved
  staff_note     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_guest_req_reservation ON guest_requests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_guest_req_restaurant  ON guest_requests(restaurant_id, status, created_at DESC);

ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;

-- Gost može inserovati (nema auth — rezervacija_id je "token")
CREATE POLICY "Guest inserts request"
  ON guest_requests FOR INSERT
  WITH CHECK (true);

-- Vlasnik i osoblje čitaju i ažuriraju
CREATE POLICY "Staff manages guest_requests"
  ON guest_requests FOR ALL
  USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
    OR restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- ──────────────────────────────────────────────────────────────
-- RPC 1: pronađi rezervaciju po kodu (prvih 8 znakova UUID) + email
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_guest_reservation(
  p_code          TEXT,
  p_email         TEXT,
  p_restaurant_id UUID
)
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
  LEFT JOIN room_types rt ON r.room_type_id  = rt.id
  LEFT JOIN rooms       rm ON r.room_id       = rm.id
  WHERE r.restaurant_id = p_restaurant_id
    AND UPPER(LEFT(r.id::text, 8)) = UPPER(LEFT(TRIM(p_code), 8))
    AND LOWER(r.guest_email)       = LOWER(TRIM(p_email))
    AND r.status IN ('confirmed', 'checked_in')
  LIMIT 1;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPC 2: folio stavke za rezervaciju (reservation_id je token)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_guest_folio(p_reservation_id UUID)
RETURNS TABLE (
  folio_id        UUID,
  folio_status    TEXT,
  folio_total     NUMERIC,
  item_id         UUID,
  description     TEXT,
  type            TEXT,
  quantity        NUMERIC,
  unit_price      NUMERIC,
  total_price     NUMERIC,
  item_created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    f.id            AS folio_id,
    f.status        AS folio_status,
    f.total_amount  AS folio_total,
    fi.id           AS item_id,
    fi.description,
    fi.type,
    fi.quantity,
    fi.unit_price,
    fi.total_price,
    fi.created_at   AS item_created_at
  FROM folios f
  LEFT JOIN folio_items fi ON fi.folio_id = f.id
  WHERE f.reservation_id = p_reservation_id
  ORDER BY fi.created_at ASC NULLS LAST;
$$;

-- ──────────────────────────────────────────────────────────────
-- RPC 3: zahtjevi gosta za rezervaciju
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_guest_requests(p_reservation_id UUID)
RETURNS TABLE (
  id          UUID,
  category    TEXT,
  message     TEXT,
  status      TEXT,
  created_at  TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, category, message, status, created_at, resolved_at
  FROM guest_requests
  WHERE reservation_id = p_reservation_id
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_guest_reservation(TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_guest_folio(UUID)                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_guest_requests(UUID)                TO anon, authenticated;
