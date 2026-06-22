-- ============================================================================
-- RENTAL šema — RENT-0 temelj (Faza RENT v2.1). Vertikala `rental`, addon rental_core.
-- ----------------------------------------------------------------------------
-- Generički motor najma: asset-agnostično jezgro (`rental_assets` + `rental_bookings`)
-- + satelitske tabele PO VRSTI (`accommodation` sad; `vehicle` slot dokumentovan, ne
-- gradi se). KREĆE od plažnog/priobalnog imobilijara (apartmani/vile/studija).
--
-- KLJUČNE ODLUKE (v. restbyme_hotel_roadmap.md → Faza RENT v2.1):
--   • Booking/availability je NOVO (hotel get_available_rooms tvrdo vezan za hotel_*).
--     Overbooking guard = DB-level EXCLUDE constraint (atomičan, bez race-conditiona).
--     Dnevna granularnost (daterange/DATE) = tačno za accommodation; vozila → tstzrange.
--   • Folio se NE koristi — novčane kolone žive na rental_bookings (samodostatno).
--   • Vlasništvo je osobina sredstva: owner_id NULL = vlastito; popunjen = tuđe (agencija).
--   • Lokacija je FIRST-CLASS (rental_locations) — budući `properties` refaktor aditivan.
--   • FK redoslijed: locations + owners PRIJE assets (asset referencira oba).
--   • Naziv/opis sredstva NE drže _en kolone — prevod kroz content_translations
--     (entity_type='rental_asset'), CLAUDE.md §6 Sloj B.
--   • Tenant model (CLAUDE.md §1): svaka tabela restaurant_id NOT NULL + RLS uz migraciju
--     (vlasnik manage + public.is_superadmin()). Anon NEMA pristup — javni booking (RENT-0b)
--     ide kroz SECURITY DEFINER RPC.
-- ============================================================================

-- EXCLUDE constraint nad (uuid =, daterange &&) zahtijeva btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1) Preduslovi (referencirane tabele prve) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  address       text,
  city          text,
  country_code  text DEFAULT 'ME',
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_locations_restaurant ON public.rental_locations (restaurant_id);

CREATE TABLE IF NOT EXISTS public.rental_owners (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id          uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  email                  text,
  phone                  text,
  iban                   text,
  default_commission_pct numeric(5,2) DEFAULT 0,
  user_id                uuid REFERENCES auth.users(id),   -- owner portal (RENT-2)
  created_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_owners_restaurant ON public.rental_owners (restaurant_id);

-- ── 2) Asset-agnostično jezgro ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  location_id    uuid REFERENCES public.rental_locations(id) ON DELETE SET NULL,
  asset_kind     text NOT NULL DEFAULT 'accommodation',  -- accommodation|vehicle
  owner_id       uuid REFERENCES public.rental_owners(id) ON DELETE SET NULL,  -- NULL = vlastito
  commission_pct numeric(5,2),                            -- override default vlasnika
  name           text NOT NULL,
  status         text NOT NULL DEFAULT 'active',
  base_price     numeric(10,2),
  pricing_unit   text DEFAULT 'night',                    -- night|day|hour
  cleaning_fee   numeric(10,2) DEFAULT 0,
  min_duration   integer DEFAULT 1,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT rental_assets_kind_check   CHECK (asset_kind IN ('accommodation','vehicle')),
  CONSTRAINT rental_assets_status_check CHECK (status IN ('active','inactive','archived'))
);
COMMENT ON TABLE public.rental_assets IS
  'Iznajmljiva cjelina (asset). asset_kind grana satelitske tabele. owner_id NULL=vlastito/popunjen=tuđe (agencija). Naziv/opis se prevode kroz content_translations (entity_type=rental_asset), NE _en kolonama.';
CREATE INDEX IF NOT EXISTS idx_rental_assets_restaurant ON public.rental_assets (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rental_assets_location   ON public.rental_assets (location_id);
CREATE INDEX IF NOT EXISTS idx_rental_assets_owner      ON public.rental_assets (owner_id);

CREATE TABLE IF NOT EXISTS public.rental_pricing (        -- sezonski override
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES public.rental_assets(id) ON DELETE CASCADE,
  date_from     date NOT NULL,
  date_to       date NOT NULL,
  price         numeric(10,2) NOT NULL,
  min_duration  integer,
  CONSTRAINT rental_pricing_range_check CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS idx_rental_pricing_asset ON public.rental_pricing (asset_id, date_from, date_to);

CREATE TABLE IF NOT EXISTS public.rental_settings (
  restaurant_id                 uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tourist_tax_per_person        numeric(10,2) DEFAULT 0,
  tourist_tax_currency          text DEFAULT 'EUR',
  tourist_tax_child_age_exempt  integer,                  -- oslobođenje po uzrastu (regulatorno, potvrditi)
  eturista_facility_id          text,                     -- za API integraciju (RENT-4)
  fiscal_enabled                boolean DEFAULT true,     -- gasi fiskalni put ako tenant nije obveznik
  default_check_in_instructions text
);

CREATE TABLE IF NOT EXISTS public.rental_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  asset_id       uuid NOT NULL REFERENCES public.rental_assets(id) ON DELETE RESTRICT,  -- čuvaj istoriju → arhiviraj asset, ne briši
  customer_id    uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  source         text DEFAULT 'direct',                   -- direct|booking|airbnb|vrbo
  external_ref   text,
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  guest_name     text NOT NULL,
  guest_email    text,
  guest_phone    text,
  base_total     numeric(10,2),
  cleaning_fee   numeric(10,2) DEFAULT 0,
  deposit        numeric(10,2) DEFAULT 0,
  total_amount   numeric(10,2),
  payment_status text NOT NULL DEFAULT 'pending',         -- pending|partial|paid|refunded
  status         text NOT NULL DEFAULT 'confirmed',       -- confirmed|checked_in|checked_out|cancelled
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT rental_bookings_range_check   CHECK (end_date > start_date),
  CONSTRAINT rental_bookings_payment_check CHECK (payment_status IN ('pending','partial','paid','refunded')),
  CONSTRAINT rental_bookings_status_check  CHECK (status IN ('confirmed','checked_in','checked_out','cancelled')),
  -- Overbooking guard: jedno sredstvo ne može imati dvije nezatvorene rezervacije koje se
  -- preklapaju u datumima. Dnevna granularnost ('[)' half-open → checkout=checkin ne sudara).
  CONSTRAINT rental_bookings_no_overlap EXCLUDE USING gist (
    asset_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (status <> 'cancelled')
);
COMMENT ON CONSTRAINT rental_bookings_no_overlap ON public.rental_bookings IS
  'Sprečava dvostruku rezervaciju istog sredstva (atomično, na DB nivou). Otkazane (cancelled) izuzete. Dnevna granularnost — vozila po satu tražiće tstzrange varijantu (RENT-FLEET).';
CREATE INDEX IF NOT EXISTS idx_rental_bookings_restaurant ON public.rental_bookings (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_asset_dates ON public.rental_bookings (asset_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_customer   ON public.rental_bookings (customer_id);

-- ── 3) Vrsta „smještaj" (satelitske — postoje SAD) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_accommodation_details (
  asset_id              uuid PRIMARY KEY REFERENCES public.rental_assets(id) ON DELETE CASCADE,
  max_guests            integer,
  bedrooms              integer,
  beds                  integer,
  bathrooms             integer,
  amenities             text[] DEFAULT '{}',
  house_rules           text,
  access_type           text DEFAULT 'keybox',            -- keybox|smart_lock|licno
  check_in_instructions text,
  description           text                              -- prevod kroz content_translations (BEZ description_en)
);

CREATE TABLE IF NOT EXISTS public.rental_accommodation_stays (
  booking_id  uuid PRIMARY KEY REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  adults      integer DEFAULT 1,
  children    integer DEFAULT 0,
  tourist_tax numeric(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rental_guest_registrations (   -- eTurista/MUP (lični dokumenti!)
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id      uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE CASCADE,
  full_name       text,
  document_type   text,
  document_number text,
  nationality     text,
  birth_date      date,
  registered_at   timestamptz,
  eturista_ref    text
);
CREATE INDEX IF NOT EXISTS idx_rental_guest_reg_booking ON public.rental_guest_registrations (booking_id);

-- Vrsta „vozila" (NE pravimo sad — dokumentovan prazan slot, RENT-FLEET):
--   rental_vehicle_details (asset_id PK, make, model, year, plate, transmission, seats, fuel_type, current_km)
--   rental_vehicle_trips   (booking_id PK, pickup_loc, dropoff_loc, start_km, end_km, fuel_out/in, damage_notes)

-- ── RLS (vlasnik upravlja svojim; superadmin sve) ────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rental_locations','rental_owners','rental_assets','rental_pricing','rental_settings',
    'rental_bookings','rental_accommodation_details','rental_accommodation_stays','rental_guest_registrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', t);
  END LOOP;
END $$;

-- Tabele sa restaurant_id direktno → standardni vlasnik/superadmin obrazac.
CREATE POLICY "Vlasnik upravlja rental lokacijama" ON public.rental_locations FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental vlasnicima" ON public.rental_owners FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental sredstvima" ON public.rental_assets FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental cijenama" ON public.rental_pricing FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental postavkama" ON public.rental_settings FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental rezervacijama" ON public.rental_bookings FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja rental prijavama gostiju" ON public.rental_guest_registrations FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

-- Satelitske tabele bez restaurant_id → izolacija preko parent asset/booking (denormalizacija
-- bi bila alternativa; ovdje join na parent je dovoljan jer su 1:1 i admin-only).
CREATE POLICY "Vlasnik upravlja detaljima smještaja" ON public.rental_accommodation_details FOR ALL
  USING (asset_id IN (SELECT a.id FROM public.rental_assets a
           JOIN public.restaurants r ON r.id = a.restaurant_id WHERE r.user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (asset_id IN (SELECT a.id FROM public.rental_assets a
           JOIN public.restaurants r ON r.id = a.restaurant_id WHERE r.user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Vlasnik upravlja boravcima smještaja" ON public.rental_accommodation_stays FOR ALL
  USING (booking_id IN (SELECT b.id FROM public.rental_bookings b
           JOIN public.restaurants r ON r.id = b.restaurant_id WHERE r.user_id = auth.uid()) OR public.is_superadmin())
  WITH CHECK (booking_id IN (SELECT b.id FROM public.rental_bookings b
           JOIN public.restaurants r ON r.id = b.restaurant_id WHERE r.user_id = auth.uid()) OR public.is_superadmin());

-- ── updated_at trigeri (assets, bookings) ────────────────────────────────────
CREATE TRIGGER rental_assets_updated_at   BEFORE UPDATE ON public.rental_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rental_bookings_updated_at BEFORE UPDATE ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Auto-guest trigger (analogno trg_hotel_reservation_auto_guest) ───────────
-- ZAŠTO: jedinstven CRM (guests) preko svih vertikala — rezervacija sa e-mailom
-- automatski kreira/linkuje gosta i puni rental_bookings.customer_id.
CREATE OR REPLACE FUNCTION public.trg_fn_rental_booking_auto_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gid       uuid;
  v_fname     text;
  v_lname     text;
  v_space_pos int;
BEGIN
  IF NEW.customer_id IS NULL AND NEW.guest_email IS NOT NULL AND NEW.guest_email <> '' THEN
    SELECT id INTO v_gid FROM guests
    WHERE restaurant_id = NEW.restaurant_id AND lower(email) = lower(NEW.guest_email)
    LIMIT 1;

    -- guests.first_name je NOT NULL → split guest_name u first/last (kao hotel trigger).
    v_space_pos := position(' ' IN trim(NEW.guest_name));
    IF v_space_pos > 0 THEN
      v_fname := trim(substring(NEW.guest_name FROM 1 FOR v_space_pos));
      v_lname := trim(substring(NEW.guest_name FROM v_space_pos + 1));
    ELSE
      v_fname := trim(NEW.guest_name);
      v_lname := NULL;
    END IF;

    IF v_gid IS NULL THEN
      INSERT INTO guests (restaurant_id, name, first_name, last_name, email, phone)
      VALUES (NEW.restaurant_id, NEW.guest_name, v_fname, v_lname,
              lower(NEW.guest_email), NEW.guest_phone)
      RETURNING id INTO v_gid;
    ELSE
      UPDATE guests SET last_visit_at = now(),
        name       = COALESCE(NULLIF(name,''), NEW.guest_name),
        first_name = COALESCE(NULLIF(first_name,''), v_fname),
        phone      = COALESCE(phone, NEW.guest_phone)
      WHERE id = v_gid;
    END IF;

    NEW.customer_id := v_gid;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_booking_auto_guest ON public.rental_bookings;
CREATE TRIGGER trg_rental_booking_auto_guest
  BEFORE INSERT ON public.rental_bookings
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_rental_booking_auto_guest();

-- ── Realtime (kalendar rezervacija) — CLAUDE.md §7 ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rental_bookings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_bookings';
  END IF;
END $$;
ALTER TABLE public.rental_bookings REPLICA IDENTITY FULL;
