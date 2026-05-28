-- ================================================================
-- Faza 6: Hotel Core modul
-- Tabele: room_types, rooms, hotel_reservations, folios, folio_items
-- ================================================================

-- Tipovi smještajnih jedinica
CREATE TABLE IF NOT EXISTS room_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  max_occupancy   INT DEFAULT 2,
  base_price      NUMERIC(10,2),
  amenities       JSONB DEFAULT '[]',
  images          JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Konkretne sobe/jedinice
CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_type_id    UUID REFERENCES room_types(id) ON DELETE SET NULL,
  room_number     TEXT NOT NULL,
  floor           INT,
  status          TEXT DEFAULT 'available',
  -- available | occupied | cleaning | maintenance | blocked
  notes           TEXT,
  last_cleaned_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, room_number)
);

-- Hotel rezervacije (odvojeno od restoran rezervacija)
CREATE TABLE IF NOT EXISTS hotel_reservations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_id             UUID REFERENCES rooms(id) ON DELETE SET NULL,
  room_type_id        UUID REFERENCES room_types(id) ON DELETE SET NULL,
  guest_id            UUID REFERENCES guests(id) ON DELETE SET NULL,

  -- Termini
  check_in_date       DATE NOT NULL,
  check_out_date      DATE NOT NULL,
  actual_check_in     TIMESTAMPTZ,
  actual_check_out    TIMESTAMPTZ,

  -- Gosti
  guest_name          TEXT NOT NULL,
  guest_email         TEXT,
  guest_phone         TEXT,
  adults              INT DEFAULT 1,
  children            INT DEFAULT 0,

  -- Finansije
  rate_per_night      NUMERIC(10,2),
  total_amount        NUMERIC(10,2),
  paid_amount         NUMERIC(10,2) DEFAULT 0,
  payment_status      TEXT DEFAULT 'pending',
  -- pending | partial | paid | refunded

  -- Meta
  status              TEXT DEFAULT 'confirmed',
  -- inquiry | confirmed | checked_in | checked_out | cancelled | no_show
  source              TEXT DEFAULT 'direct',
  -- direct | booking_com | airbnb | expedia | phone | walk_in
  external_id         TEXT,
  special_requests    TEXT,
  internal_notes      TEXT,

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Folio (račun boravka — agregira sve troškove gosta)
CREATE TABLE IF NOT EXISTS folios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'open',
  -- open | closed | invoiced
  total_amount    NUMERIC(10,2) DEFAULT 0,
  paid_amount     NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Stavke folija (soba, restoran, minibar, spa, ostalo)
CREATE TABLE IF NOT EXISTS folio_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id        UUID REFERENCES folios(id) ON DELETE CASCADE,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  -- room_charge | restaurant | minibar | spa | other
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) DEFAULT 1,
  unit_price      NUMERIC(10,2),
  total_price     NUMERIC(10,2),
  date            DATE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── INDEKSI ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_types_restaurant ON room_types(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_restaurant ON rooms(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_hotel_res_restaurant ON hotel_reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_hotel_res_dates ON hotel_reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_hotel_res_status ON hotel_reservations(status);
CREATE INDEX IF NOT EXISTS idx_hotel_res_room ON hotel_reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_folios_reservation ON folios(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_items_folio ON folio_items(folio_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE room_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE folios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_items        ENABLE ROW LEVEL SECURITY;

-- room_types: vlasnik upravlja
CREATE POLICY "Owner manages room_types"
  ON room_types FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- rooms: vlasnik i osoblje čitaju, vlasnik upravlja
CREATE POLICY "Owner manages rooms"
  ON rooms FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff reads rooms"
  ON rooms FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- hotel_reservations: vlasnik i osoblje
CREATE POLICY "Owner manages hotel_reservations"
  ON hotel_reservations FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff reads hotel_reservations"
  ON hotel_reservations FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- folios: vlasnik i osoblje
CREATE POLICY "Owner manages folios"
  ON folios FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff reads folios"
  ON folios FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- folio_items: vlasnik i osoblje
CREATE POLICY "Owner manages folio_items"
  ON folio_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Staff manages folio_items"
  ON folio_items FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));
