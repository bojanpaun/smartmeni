-- ============================================================
-- Faza 8.5.A — Spa & Wellness modul
-- Tabele, RLS, indeksi, funkcija dostupnosti, folio trigger
-- ============================================================

-- ── 1. TABELE ────────────────────────────────────────────────

-- Prostorije / kabine spa centra
CREATE TABLE IF NOT EXISTS spa_rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  -- 'treatment_room' | 'wet_facility' | 'fitness' | 'group' | 'relaxation'
  type           TEXT NOT NULL DEFAULT 'treatment_room',
  capacity       INT  NOT NULL DEFAULT 1,
  description    TEXT,
  amenities      JSONB DEFAULT '[]',
  is_active      BOOLEAN DEFAULT true,
  display_order  INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Katalog tretmana
CREATE TABLE IF NOT EXISTS spa_services (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  -- 'massage' | 'facial' | 'body' | 'nail' | 'wellness' | 'group'
  category                TEXT NOT NULL DEFAULT 'massage',
  description             TEXT,
  duration_minutes        INT  NOT NULL DEFAULT 60,
  buffer_minutes          INT  NOT NULL DEFAULT 15,
  price                   NUMERIC(10,2) NOT NULL,
  price_couple            NUMERIC(10,2),
  max_guests              INT  DEFAULT 1,
  allowed_room_types      TEXT[],          -- NULL = bilo koja kabina
  image_url               TEXT,
  is_active               BOOLEAN DEFAULT true,
  requires_consultation   BOOLEAN DEFAULT false,
  display_order           INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now()
);

-- Terapeuti (proširenje staff tabele)
CREATE TABLE IF NOT EXISTS spa_therapists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  bio            TEXT,
  specializations TEXT[] DEFAULT '{}',
  languages      TEXT[] DEFAULT ARRAY['bs'],
  rating         NUMERIC(3,2),
  is_available   BOOLEAN DEFAULT true,
  UNIQUE(staff_id, restaurant_id)
);

-- Veza: terapeut ↔ tretmani koje može raditi
CREATE TABLE IF NOT EXISTS spa_therapist_services (
  therapist_id  UUID NOT NULL REFERENCES spa_therapists(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES spa_services(id)   ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, service_id)
);

-- Sezonski cjenovnik (override na spa_services.price)
CREATE TABLE IF NOT EXISTS spa_pricing_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES spa_services(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  price_override  NUMERIC(10,2) NOT NULL,
  valid_from      DATE NOT NULL,
  valid_to        DATE NOT NULL,
  -- NULL = svaki dan; [1,2,3,4,5] = pon-pet; [6,0] = sub+ned (PostgreSQL DOW)
  days_of_week    INT[],
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Spa rezervacije (termini)
CREATE TABLE IF NOT EXISTS spa_appointments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id            UUID NOT NULL REFERENCES spa_services(id),
  therapist_id          UUID REFERENCES spa_therapists(id),
  spa_room_id           UUID REFERENCES spa_rooms(id),
  guest_id              UUID REFERENCES guests(id),
  hotel_reservation_id  UUID REFERENCES hotel_reservations(id),

  -- Termin
  appointment_date      DATE NOT NULL,
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  duration_minutes      INT  NOT NULL,

  -- Gost podaci za vanjske goste (nije hotelski gost)
  external_guest_name   TEXT,
  external_guest_phone  TEXT,
  external_guest_email  TEXT,

  -- Finansije
  price                 NUMERIC(10,2) NOT NULL,
  -- 'folio' | 'card' | 'cash'
  payment_method        TEXT DEFAULT 'cash',
  -- 'pending' | 'paid' | 'refunded' | 'no_show'
  payment_status        TEXT DEFAULT 'pending',

  -- Status
  -- 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
  status                TEXT DEFAULT 'confirmed',
  notes                 TEXT,
  guest_notes           TEXT,

  -- Otkazivanje
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,

  -- Email podsjetnik
  reminder_sent_at      TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Podešavanja spa centra
CREATE TABLE IF NOT EXISTS spa_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  open_time            TIME    DEFAULT '09:00',
  close_time           TIME    DEFAULT '20:00',
  -- 0=ned, 1=pon, 2=uto, 3=sri, 4=čet, 5=pet, 6=sub (PostgreSQL DOW)
  working_days         INT[]   DEFAULT ARRAY[1,2,3,4,5,6],
  min_advance_hours    INT     DEFAULT 2,
  cancellation_hours   INT     DEFAULT 24,
  reminder_hours       INT     DEFAULT 2,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Retail spa proizvodi (prodaja gostima)
CREATE TABLE IF NOT EXISTS spa_retail_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  brand          TEXT,
  price          NUMERIC(10,2),
  stock_quantity INT DEFAULT 0,
  image_url      TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Spa paketi (smještaj + tretmani = paket cijena)
CREATE TABLE IF NOT EXISTS spa_packages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  -- [{type:'room_type', id:'...', nights:2},
  --  {type:'spa_service', id:'...', quantity:2},
  --  {type:'meal', description:'Breakfast included'}]
  includes       JSONB NOT NULL DEFAULT '[]',
  total_price    NUMERIC(10,2),
  valid_from     DATE,
  valid_to       DATE,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── 2. INDEKSI ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_spa_rooms_restaurant
  ON spa_rooms(restaurant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_spa_services_restaurant
  ON spa_services(restaurant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_spa_therapists_restaurant
  ON spa_therapists(restaurant_id) WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_spa_appointments_restaurant_date
  ON spa_appointments(restaurant_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_spa_appointments_therapist_date
  ON spa_appointments(therapist_id, appointment_date)
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS idx_spa_appointments_room_date
  ON spa_appointments(spa_room_id, appointment_date)
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS idx_spa_appointments_reminder
  ON spa_appointments(appointment_date, start_time)
  WHERE reminder_sent_at IS NULL AND status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_spa_pricing_rules_service
  ON spa_pricing_rules(service_id, valid_from, valid_to)
  WHERE is_active = true;

-- ── 3. RLS ───────────────────────────────────────────────────

ALTER TABLE spa_rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_therapists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_therapist_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_pricing_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_retail_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_packages          ENABLE ROW LEVEL SECURITY;

-- Vlasnik upravlja svim spa podacima svog objekta
CREATE POLICY "spa_owner_all" ON spa_rooms FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_services FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_therapists FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_pricing_rules FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_appointments FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_settings FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_retail_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
CREATE POLICY "spa_owner_all" ON spa_packages FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Staff vidi spa podatke svog objekta
CREATE POLICY "spa_staff_all" ON spa_rooms FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "spa_staff_all" ON spa_services FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "spa_staff_all" ON spa_therapists FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "spa_staff_all" ON spa_appointments FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "spa_staff_all" ON spa_settings FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- Spa_therapist_services prati spa_therapists pristup
CREATE POLICY "spa_owner_therapist_services" ON spa_therapist_services FOR ALL
  USING (therapist_id IN (
    SELECT t.id FROM spa_therapists t
    JOIN restaurants r ON r.id = t.restaurant_id
    WHERE r.user_id = auth.uid()
  ));
CREATE POLICY "spa_staff_therapist_services" ON spa_therapist_services FOR ALL
  USING (therapist_id IN (
    SELECT t.id FROM spa_therapists t
    JOIN staff s ON s.restaurant_id = t.restaurant_id
    WHERE s.user_id = auth.uid() AND s.is_active = true
  ));

-- Javno čitanje kataloga (za /:slug/spa booking stranicu)
CREATE POLICY "spa_public_read_services" ON spa_services FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "spa_public_read_rooms" ON spa_rooms FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "spa_public_read_packages" ON spa_packages FOR SELECT TO anon
  USING (is_active = true);

-- ── 4. updated_at TRIGGER ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spa_appointments_updated_at ON spa_appointments;
CREATE TRIGGER spa_appointments_updated_at
  BEFORE UPDATE ON spa_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS spa_settings_updated_at ON spa_settings;
CREATE TRIGGER spa_settings_updated_at
  BEFORE UPDATE ON spa_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. get_available_spa_slots() ─────────────────────────────

DROP FUNCTION IF EXISTS get_available_spa_slots(UUID, UUID, DATE, UUID);

CREATE OR REPLACE FUNCTION get_available_spa_slots(
  p_restaurant_id UUID,
  p_service_id    UUID,
  p_date          DATE,
  p_therapist_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  slot_start      TIME,
  slot_end        TIME,
  therapist_id    UUID,
  therapist_name  TEXT,
  spa_room_id     UUID,
  room_name       TEXT,
  price           NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service        spa_services%ROWTYPE;
  v_total_minutes  INT;
  v_open_time      TIME;
  v_close_time     TIME;
BEGIN
  -- Učitaj tretman
  SELECT * INTO v_service FROM spa_services
  WHERE id = p_service_id AND restaurant_id = p_restaurant_id AND is_active = true;
  IF NOT FOUND THEN RETURN; END IF;

  v_total_minutes := v_service.duration_minutes + v_service.buffer_minutes;

  -- Učitaj radno vrijeme iz spa_settings (fallback na 09:00–20:00)
  SELECT
    COALESCE(MAX(ss.open_time),  '09:00'::TIME),
    COALESCE(MAX(ss.close_time), '20:00'::TIME)
  INTO v_open_time, v_close_time
  FROM spa_settings ss
  WHERE ss.restaurant_id = p_restaurant_id;

  -- Provjeri radi li spa ovaj dan tjedna
  IF EXISTS (
    SELECT 1 FROM spa_settings ss
    WHERE ss.restaurant_id = p_restaurant_id
      AND ss.working_days IS NOT NULL
      AND NOT (EXTRACT(DOW FROM p_date)::INT = ANY(ss.working_days))
  ) THEN RETURN; END IF;

  RETURN QUERY
  WITH time_slots AS (
    -- Generiše potencijalne slotove svakih 30 min u radnom vremenu
    SELECT generate_series(
      p_date + v_open_time,
      p_date + v_close_time - (v_total_minutes || ' minutes')::INTERVAL,
      '30 minutes'::INTERVAL
    )::TIMESTAMP AS slot_ts
  ),
  effective_price AS (
    -- Najjeftinija aktivna sezonska cijena ili osnovna cijena
    SELECT COALESCE(
      (SELECT pr.price_override
       FROM spa_pricing_rules pr
       WHERE pr.service_id = p_service_id
         AND p_date BETWEEN pr.valid_from AND pr.valid_to
         AND pr.is_active = true
         AND (pr.days_of_week IS NULL
              OR EXTRACT(DOW FROM p_date)::INT = ANY(pr.days_of_week))
       ORDER BY pr.price_override ASC
       LIMIT 1),
      v_service.price
    ) AS final_price
  ),
  available_therapists AS (
    SELECT
      t.id AS tid,
      s.first_name || ' ' || s.last_name AS tname
    FROM spa_therapists t
    JOIN staff s ON s.id = t.staff_id
    JOIN spa_therapist_services ts ON ts.therapist_id = t.id
    WHERE t.restaurant_id = p_restaurant_id
      AND ts.service_id   = p_service_id
      AND t.is_available  = true
      AND (p_therapist_id IS NULL OR t.id = p_therapist_id)
  ),
  available_rooms AS (
    SELECT r.id AS rid, r.name AS rname
    FROM spa_rooms r
    WHERE r.restaurant_id = p_restaurant_id
      AND r.is_active     = true
      AND (v_service.allowed_room_types IS NULL
           OR v_service.allowed_room_types @> ARRAY[r.type])
  )
  SELECT
    sl.slot_ts::TIME                                          AS slot_start,
    (sl.slot_ts + (v_service.duration_minutes || ' minutes')::INTERVAL)::TIME AS slot_end,
    at.tid                                                    AS therapist_id,
    at.tname                                                  AS therapist_name,
    ar.rid                                                    AS spa_room_id,
    ar.rname                                                  AS room_name,
    ep.final_price                                            AS price
  FROM time_slots sl
  CROSS JOIN available_therapists at
  CROSS JOIN available_rooms      ar
  CROSS JOIN effective_price      ep
  WHERE
    -- Terapeut nema preklapajući termin (uz buffer)
    NOT EXISTS (
      SELECT 1 FROM spa_appointments a
      WHERE a.therapist_id      = at.tid
        AND a.appointment_date  = p_date
        AND a.status NOT IN ('cancelled', 'no_show')
        AND sl.slot_ts::TIME    < a.end_time
        AND (sl.slot_ts + (v_total_minutes || ' minutes')::INTERVAL)::TIME > a.start_time
    )
    -- Kabina nije zauzeta (uz buffer)
    AND NOT EXISTS (
      SELECT 1 FROM spa_appointments a
      WHERE a.spa_room_id       = ar.rid
        AND a.appointment_date  = p_date
        AND a.status NOT IN ('cancelled', 'no_show')
        AND sl.slot_ts::TIME    < a.end_time
        AND (sl.slot_ts + (v_total_minutes || ' minutes')::INTERVAL)::TIME > a.start_time
    )
  ORDER BY sl.slot_ts, at.tname;
END;
$$;

-- Javni pristup za booking stranicu
GRANT EXECUTE ON FUNCTION get_available_spa_slots(UUID, UUID, DATE, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_available_spa_slots(UUID, UUID, DATE, UUID) TO authenticated;

-- ── 6. DB TRIGGER — automatski folio item za hotelske goste ──

CREATE OR REPLACE FUNCTION create_spa_folio_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_name TEXT;
  v_folio_id     UUID;
BEGIN
  -- Samo za confirmed termini s folio plaćanjem i hotel rezervacijom
  IF NEW.payment_method = 'folio'
     AND NEW.hotel_reservation_id IS NOT NULL
     AND NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
  THEN
    SELECT name INTO v_service_name
    FROM spa_services WHERE id = NEW.service_id;

    SELECT f.id INTO v_folio_id
    FROM folios f
    WHERE f.reservation_id = NEW.hotel_reservation_id
      AND f.status = 'open'
    LIMIT 1;

    IF v_folio_id IS NOT NULL THEN
      INSERT INTO folio_items (
        folio_id, type, description,
        quantity, unit_price, total_price, date
      ) VALUES (
        v_folio_id,
        'spa',
        COALESCE(v_service_name, 'Spa tretman') || ' — ' ||
          to_char(NEW.appointment_date, 'DD.MM.YYYY') || ' ' ||
          to_char(NEW.start_time, 'HH24:MI'),
        1,
        NEW.price,
        NEW.price,
        NEW.appointment_date
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spa_folio ON spa_appointments;
CREATE TRIGGER trg_spa_folio
  AFTER INSERT OR UPDATE ON spa_appointments
  FOR EACH ROW EXECUTE FUNCTION create_spa_folio_item();

-- ── 7. DB TRIGGER — soba na 'cleaning' nakon spa tretmana ────

CREATE OR REPLACE FUNCTION trg_fn_spa_room_cleaning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kad je tretman završen, označi kabinu za čišćenje
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.spa_room_id IS NOT NULL
  THEN
    INSERT INTO housekeeping_tasks (
      restaurant_id, room_id, type, status, priority,
      scheduled_for, notes
    )
    SELECT
      NEW.restaurant_id,
      r.id,         -- room_id iz rooms tabele (NE spa_room)
      'stayover_clean',
      'pending',
      'normal',
      NEW.appointment_date,
      'Čišćenje spa kabine nakon tretmana'
    FROM spa_rooms sr
    -- Pokušaj naći hotelsku sobu s istim brojem (opciono, može biti null)
    LEFT JOIN rooms r ON r.restaurant_id = NEW.restaurant_id
      AND r.room_number = sr.name
    WHERE sr.id = NEW.spa_room_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spa_room_cleaning ON spa_appointments;
CREATE TRIGGER trg_spa_room_cleaning
  AFTER UPDATE ON spa_appointments
  FOR EACH ROW EXECUTE FUNCTION trg_fn_spa_room_cleaning();
