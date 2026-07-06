-- ============================================================================
-- RENT-0b — anon SECURITY DEFINER RPC-ovi za JAVNI booking rental sredstava.
-- ----------------------------------------------------------------------------
-- Anon ne smije čitati rental_* (RLS owner-only), pa javni booking ide kroz ove
-- funkcije (isti obrazac kao hotel get_available_rooms / create_booking_direct).
--
-- GEJTING (sigurnost): sve tri gejtuju na `restaurants.active_verticals` sadrži
--   'rental' (public vidljivost vertikale) + `rental_assets.status='active'` +
--   `asset_kind='accommodation'`. Ne-rental tenant / neaktivno sredstvo → prazno/RAISE.
-- QUOTE: server-side (klijent NE šalje cijenu) — `rental_quote_public` je jedini
--   izvor; `create_...` ga ponovo računa (anti-tamper). Ogledalo `rental_quote_price`
--   (admin, INVOKER) ali DEFINER + gejt (jer anon nema RLS pristup rental_*).
-- DEPOZIT: 30% ukupnog (potvrda rezervacije online; ostatak na dolasku). Kad se doda
--   `rental_settings.deposit_pct`, ovdje čitati nju umjesto konstante.
-- ============================================================================

-- ── 1) Quote (anon) — cijena za jedno sredstvo/datume. Ujedno helper za ostale. ──
CREATE OR REPLACE FUNCTION public.rental_quote_public(
  p_asset_id uuid,
  p_start    date,
  p_end      date,
  p_adults   int DEFAULT 1,
  p_children int DEFAULT 0
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rest       uuid;
  v_base       numeric;
  v_cleaning   numeric;
  v_nights     int;
  v_base_total numeric := 0;
  v_tax_per    numeric := 0;
  v_tax_total  numeric := 0;
  v_day_price  numeric;
  d            date;
BEGIN
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'Datum odjave mora biti poslije datuma prijave' USING ERRCODE = '22023';
  END IF;

  -- Gejt: sredstvo aktivno + tenant ima 'rental' vertikalu (javna vidljivost).
  SELECT a.restaurant_id, COALESCE(a.base_price, 0), COALESCE(a.cleaning_fee, 0)
    INTO v_rest, v_base, v_cleaning
  FROM rental_assets a
  JOIN restaurants r ON r.id = a.restaurant_id AND 'rental' = ANY(r.active_verticals)
  WHERE a.id = p_asset_id AND a.status = 'active' AND a.asset_kind = 'accommodation';
  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Sredstvo nije dostupno' USING ERRCODE = '22023';
  END IF;

  v_nights := p_end - p_start;

  d := p_start;
  WHILE d < p_end LOOP
    SELECT price INTO v_day_price
    FROM rental_pricing
    WHERE asset_id = p_asset_id AND d >= date_from AND d <= date_to
    ORDER BY (date_to - date_from) ASC
    LIMIT 1;
    v_base_total := v_base_total + COALESCE(v_day_price, v_base);
    d := d + 1;
  END LOOP;

  SELECT COALESCE(tourist_tax_per_person, 0) INTO v_tax_per
  FROM rental_settings WHERE restaurant_id = v_rest;
  v_tax_total := COALESCE(v_tax_per, 0) * v_nights * (COALESCE(p_adults, 0) + COALESCE(p_children, 0));

  RETURN json_build_object(
    'nights',       v_nights,
    'base_total',   round(v_base_total, 2),
    'cleaning_fee', round(v_cleaning, 2),
    'tourist_tax',  round(v_tax_total, 2),
    'total_amount', round(v_base_total + v_cleaning + v_tax_total, 2)
  );
END;
$$;

COMMENT ON FUNCTION public.rental_quote_public(uuid, date, date, int, int) IS
  'RENT-0b: anon quote za javni booking (DEFINER + gejt: aktivno sredstvo + rental vertikala). Server-side cijena; create ga ponovo računa.';

-- ── 2) Dostupna sredstva za datume (anon) — lista + quote po sredstvu. ──
CREATE OR REPLACE FUNCTION public.get_available_rental_assets(
  p_restaurant_id uuid,
  p_start         date,
  p_end           date,
  p_guests        int DEFAULT 1
) RETURNS TABLE (
  asset_id      uuid,
  name          text,
  description   text,
  location_name text,
  city          text,
  base_price    numeric,
  cleaning_fee  numeric,
  min_duration  int,
  max_guests    int,
  bedrooms      int,
  beds          int,
  bathrooms     int,
  amenities     text[],
  nights        int,
  base_total    numeric,
  tourist_tax   numeric,
  total_amount  numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.name,
    d.description,
    loc.name,
    loc.city,
    a.base_price,
    COALESCE(a.cleaning_fee, 0),
    COALESCE(a.min_duration, 1),
    d.max_guests,
    d.bedrooms,
    d.beds,
    d.bathrooms,
    COALESCE(d.amenities, '{}'),
    (p_end - p_start)                             AS nights,
    (q.q->>'base_total')::numeric                 AS base_total,
    (q.q->>'tourist_tax')::numeric                AS tourist_tax,
    (q.q->>'total_amount')::numeric               AS total_amount
  FROM rental_assets a
  JOIN restaurants r ON r.id = a.restaurant_id AND 'rental' = ANY(r.active_verticals)
  LEFT JOIN rental_accommodation_details d ON d.asset_id = a.id
  LEFT JOIN rental_locations loc ON loc.id = a.location_id
  CROSS JOIN LATERAL (SELECT public.rental_quote_public(a.id, p_start, p_end, p_guests, 0) AS q) q
  WHERE a.restaurant_id = p_restaurant_id
    AND a.status = 'active'
    AND a.asset_kind = 'accommodation'
    AND p_end > p_start
    AND (d.max_guests IS NULL OR d.max_guests >= p_guests)
    AND (p_end - p_start) >= COALESCE(a.min_duration, 1)
    AND NOT EXISTS (
      SELECT 1 FROM rental_bookings b
      WHERE b.asset_id = a.id
        AND b.status <> 'cancelled'
        AND daterange(b.start_date, b.end_date, '[)') && daterange(p_start, p_end, '[)')
    )
  ORDER BY a.base_price NULLS LAST, a.name;
$$;

COMMENT ON FUNCTION public.get_available_rental_assets(uuid, date, date, int) IS
  'RENT-0b: anon lista slobodnih rental sredstava za datume (EXCLUDE-aware) + quote po sredstvu. Gejt: rental vertikala + status active.';

-- ── 3) Kreiranje rezervacije (anon) — server-side re-quote → insert + stay. ──
CREATE OR REPLACE FUNCTION public.create_rental_booking_public(
  p_restaurant_id uuid,
  p_asset_id      uuid,
  p_start         date,
  p_end           date,
  p_adults        int,
  p_children      int,
  p_guest_name    text,
  p_guest_email   text,
  p_guest_phone   text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_q        json;
  v_min      int;
  v_deposit  numeric;
  v_total    numeric;
  v_bid      uuid;
BEGIN
  IF p_guest_name IS NULL OR trim(p_guest_name) = '' THEN
    RAISE EXCEPTION 'Ime gosta je obavezno' USING ERRCODE = '22023';
  END IF;

  -- Gejt + min_duration (asset mora pripadati p_restaurant_id, aktivan, rental vertikala).
  SELECT COALESCE(a.min_duration, 1) INTO v_min
  FROM rental_assets a
  JOIN restaurants r ON r.id = a.restaurant_id AND 'rental' = ANY(r.active_verticals)
  WHERE a.id = p_asset_id AND a.restaurant_id = p_restaurant_id
    AND a.status = 'active' AND a.asset_kind = 'accommodation';
  IF v_min IS NULL THEN
    RAISE EXCEPTION 'Sredstvo nije dostupno' USING ERRCODE = '22023';
  END IF;
  IF (p_end - p_start) < v_min THEN
    RAISE EXCEPTION 'Minimalno trajanje je % noći', v_min USING ERRCODE = '22023';
  END IF;

  -- Server-side quote (anti-tamper) — isti izvor kao prikaz.
  v_q := public.rental_quote_public(p_asset_id, p_start, p_end, p_adults, p_children);
  v_total   := (v_q->>'total_amount')::numeric;
  v_deposit := round(v_total * 0.30, 2);

  -- Insert rezervacije. EXCLUDE guard (23P01) na preklapanje → prijateljska greška.
  BEGIN
    INSERT INTO rental_bookings (
      restaurant_id, asset_id, source, start_date, end_date,
      guest_name, guest_email, guest_phone,
      base_total, cleaning_fee, deposit, total_amount, payment_status, status
    ) VALUES (
      p_restaurant_id, p_asset_id, 'booking', p_start, p_end,
      trim(p_guest_name), lower(nullif(trim(p_guest_email), '')), nullif(trim(p_guest_phone), ''),
      (v_q->>'base_total')::numeric, (v_q->>'cleaning_fee')::numeric, v_deposit, v_total,
      'pending', 'confirmed'
    ) RETURNING id INTO v_bid;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Termin je upravo zauzet za izabrane datume' USING ERRCODE = '23P01';
  END;

  INSERT INTO rental_accommodation_stays (booking_id, adults, children, tourist_tax)
  VALUES (v_bid, COALESCE(p_adults, 1), COALESCE(p_children, 0), (v_q->>'tourist_tax')::numeric);

  RETURN json_build_object(
    'booking_id',   v_bid,
    'nights',       (v_q->>'nights')::int,
    'base_total',   (v_q->>'base_total')::numeric,
    'cleaning_fee', (v_q->>'cleaning_fee')::numeric,
    'tourist_tax',  (v_q->>'tourist_tax')::numeric,
    'total_amount', v_total,
    'deposit',      v_deposit,
    'guest_name',   trim(p_guest_name)
  );
END;
$$;

COMMENT ON FUNCTION public.create_rental_booking_public(uuid, uuid, date, date, int, int, text, text, text) IS
  'RENT-0b: anon kreiranje rental rezervacije (server-side re-quote, EXCLUDE guard, auto-guest trigger). Vraća booking_id + iznose za plaćanje depozita (30%).';

-- Grantovi (anon + authenticated). rental_quote_public helper je i anon (živi quote).
GRANT EXECUTE ON FUNCTION public.rental_quote_public(uuid, date, date, int, int)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_rental_assets(uuid, date, date, int)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_rental_booking_public(uuid, uuid, date, date, int, int, text, text, text) TO anon, authenticated;
