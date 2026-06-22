-- ============================================================================
-- rental_quote_price — server-side obračun cijene rezervacije (RENT-0a).
-- ----------------------------------------------------------------------------
-- CLAUDE.md §3: kompleksna kalkulacija (sezonske cijene) živi u PostgreSQL-u, NE
-- reimplementirana u JS — jedan izvor istine. Vraća JSON razlomak za UI + osnovu
-- za rental_bookings (base_total/cleaning_fee/tourist_tax/total_amount).
--
-- Logika cijene: za SVAKI dan boravka uzmi NAJUŽI primjenjivi sezonski red
-- (rental_pricing), fallback rental_assets.base_price. + cleaning_fee (jednom).
-- Boravišna taksa: per_person × noćenja × (adults + children). Uzrasno oslobođenje
-- (tourist_tax_child_age_exempt) NIJE primijenjeno ovdje — traži pojedinačne uzraste
-- gostiju (prikupljaju se pri prijavi, RENT-4); regulatorno otvoreno (roadmap §10).
--
-- SECURITY INVOKER namjerno: RLS se primjenjuje (admin vidi samo svoja sredstva).
-- Javni booking (RENT-0b) za anon dobiće zaseban anon-bezbjedan put.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rental_quote_price(
  p_asset_id uuid,
  p_start    date,
  p_end      date,
  p_adults   int DEFAULT 1,
  p_children int DEFAULT 0
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
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

  SELECT restaurant_id, COALESCE(base_price, 0), COALESCE(cleaning_fee, 0)
    INTO v_rest, v_base, v_cleaning
  FROM rental_assets WHERE id = p_asset_id;
  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Sredstvo % ne postoji', p_asset_id USING ERRCODE = '22023';
  END IF;

  v_nights := p_end - p_start;

  -- Dan-po-dan: najuži primjenjivi sezonski red, inače base_price.
  d := p_start;
  WHILE d < p_end LOOP
    SELECT price INTO v_day_price
    FROM rental_pricing
    WHERE asset_id = p_asset_id AND d >= date_from AND d <= date_to
    ORDER BY (date_to - date_from) ASC   -- najuži opseg pobjeđuje
    LIMIT 1;
    v_base_total := v_base_total + COALESCE(v_day_price, v_base);
    d := d + 1;
  END LOOP;

  -- Boravišna taksa (po osobi × noćenja). Uzrasno oslobođenje odgođeno (v. gore).
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

COMMENT ON FUNCTION public.rental_quote_price(uuid, date, date, int, int) IS
  'RENT-0a: obračun cijene rezervacije (sezonski override po danu → base_price; +cleaning_fee +boravišna taksa). Jedan izvor istine (CLAUDE.md §3). SECURITY INVOKER (RLS gejtuje na vlastita sredstva).';

REVOKE ALL ON FUNCTION public.rental_quote_price(uuid, date, date, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rental_quote_price(uuid, date, date, int, int) TO authenticated;
