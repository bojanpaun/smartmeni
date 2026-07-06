-- ============================================================================
-- RENT-PAY — politika plaćanja za najam (online depozit vs plaćanje po dolasku).
-- ----------------------------------------------------------------------------
-- Ogledalo hotelskog `rate_plans.payment_type`, ali na TENANT nivou (rental nema
-- pakete) i sa DEPOZIT modelom (najam već naplaćuje depozit, ne pun iznos):
--   * `rental_settings.payment_type`  'online' | 'on_arrival'  (default 'on_arrival')
--       - 'on_arrival'  → nema online naplate; rezervacija samo potvrđena, plaća se na licu mjesta.
--       - 'online'      → gost plaća depozit online (ostatak na dolasku).
--   * `rental_settings.deposit_pct`  procenat depozita za 'online' (default 30).
-- DEFAULT je 'on_arrival' svjesno: payment provajder (Monri) u CG je još dormant,
-- pa najam radi odmah bez naplate; najmodavac uključi online kad unese ključeve.
-- Uklanja hardkodovan 30% iz `create_rental_booking_public` (migr. …120000).
-- ============================================================================

ALTER TABLE public.rental_settings
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'on_arrival',
  ADD COLUMN IF NOT EXISTS deposit_pct  numeric(5,2) NOT NULL DEFAULT 30;

DO $$ BEGIN
  ALTER TABLE public.rental_settings
    ADD CONSTRAINT chk_rental_payment_type CHECK (payment_type IN ('online', 'on_arrival'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rental_settings
    ADD CONSTRAINT chk_rental_deposit_pct CHECK (deposit_pct > 0 AND deposit_pct <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.rental_settings.payment_type IS
  'RENT-PAY: online (depozit unaprijed) vs on_arrival (plaćanje na licu mjesta). Default on_arrival.';
COMMENT ON COLUMN public.rental_settings.deposit_pct IS
  'RENT-PAY: procenat depozita za payment_type=online (ostatak na dolasku).';

-- ── create_rental_booking_public: čita politiku plaćanja umjesto hardkodovanih 30%. ──
-- Return tip ostaje json → CREATE OR REPLACE (dodajemo samo `payment_type` u izlaz).
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
  v_q         json;
  v_min       int;
  v_deposit   numeric;
  v_total     numeric;
  v_bid       uuid;
  v_pay_type  text;
  v_dep_pct   numeric;
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
  v_total := (v_q->>'total_amount')::numeric;

  -- Politika plaćanja tenanta (fallback na 'on_arrival' / 30% ako red ne postoji).
  SELECT s.payment_type, s.deposit_pct INTO v_pay_type, v_dep_pct
  FROM rental_settings s WHERE s.restaurant_id = p_restaurant_id;
  v_pay_type := COALESCE(v_pay_type, 'on_arrival');
  v_dep_pct  := COALESCE(v_dep_pct, 30);
  IF v_pay_type = 'online' THEN
    v_deposit := round(v_total * v_dep_pct / 100.0, 2);
  ELSE
    v_deposit := 0;   -- plaćanje po dolasku → bez online depozita
  END IF;

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
    'payment_type', v_pay_type,
    'guest_name',   trim(p_guest_name)
  );
END;
$$;

COMMENT ON FUNCTION public.create_rental_booking_public(uuid, uuid, date, date, int, int, text, text, text) IS
  'RENT-0b/RENT-PAY: anon kreiranje rental rezervacije (server-side re-quote, EXCLUDE guard). Depozit prema rental_settings.payment_type/deposit_pct (on_arrival → 0). Vraća booking_id + iznose + payment_type.';
