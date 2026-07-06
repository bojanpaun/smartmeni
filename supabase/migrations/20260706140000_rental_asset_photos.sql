-- ============================================================================
-- RENT: slike smještaja (P1-2). Foto po smještaju kao newline-lista URL-ova
-- (isti obrazac kao landing galerije — bucket `landing-images`, javno čitljiv,
-- upload kroz shared ImageUpload). Prva slika = naslovna (cover).
-- get_available_rental_assets proširen da vraća `photos text[]` (za /rent izlog).
-- ============================================================================

ALTER TABLE public.rental_accommodation_details
  ADD COLUMN IF NOT EXISTS photo_urls text;
COMMENT ON COLUMN public.rental_accommodation_details.photo_urls IS
  'Newline-razdvojene URL slike smještaja (bucket landing-images, javne). Prva = cover.';

-- Promjena RETURNS TABLE (dodata photos kolona) → DROP pa CREATE (ne može CREATE OR REPLACE).
DROP FUNCTION IF EXISTS public.get_available_rental_assets(uuid, date, date, int);

CREATE FUNCTION public.get_available_rental_assets(
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
  photos        text[],
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
    ARRAY(
      SELECT btrim(u) FROM unnest(string_to_array(COALESCE(d.photo_urls, ''), E'\n'))
             WITH ORDINALITY AS x(u, ord)
      WHERE btrim(u) ~ '^https?://'
      ORDER BY ord
    ),
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
  'RENT-0b: anon lista slobodnih smještaja za datume (EXCLUDE-aware) + quote + photos. Gejt: rental vertikala + status active.';

GRANT EXECUTE ON FUNCTION public.get_available_rental_assets(uuid, date, date, int) TO anon, authenticated;

-- ── Demo: dodaj slike na demo smještaje (redefinicija seed_demo_rental + reset). ──
CREATE OR REPLACE FUNCTION public.seed_demo_rental()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   uuid := 'deadbeef-0000-0000-0000-000000000010';
  loc uuid := 'deadbeef-0000-0000-0000-0000000e0001';
  a1  uuid := 'deadbeef-0000-0000-0000-0000000e0011';
  a2  uuid := 'deadbeef-0000-0000-0000-0000000e0012';
BEGIN
  INSERT INTO public.rental_settings (restaurant_id, tourist_tax_per_person, tourist_tax_currency, default_check_in_instructions)
  VALUES (r, 1.00, 'EUR', 'Ključevi su u sefu pored ulaza; šifra stiže SMS-om dan prije dolaska.')
  ON CONFLICT (restaurant_id) DO NOTHING;

  INSERT INTO public.rental_locations (id, restaurant_id, name, address, city)
  VALUES (loc, r, 'Stari grad', 'Njegoševa 4', 'Budva')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_assets (id, restaurant_id, location_id, name, base_price, cleaning_fee, min_duration) VALUES
    (a1, r, loc, 'Apartman Galeb', 55.00, 20.00, 2),
    (a2, r, loc, 'Vila Maslina',  180.00, 50.00, 3)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_accommodation_details (asset_id, max_guests, bedrooms, beds, bathrooms, amenities, access_type, description, photo_urls) VALUES
    (a1, 4, 1, 2, 1, ARRAY['wifi','klima','kuhinja','pogled_more'], 'keybox',
      'Svijetao apartman 80m od plaže, terasa s pogledom na more.',
      E'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=70&auto=format'),
    (a2, 8, 3, 4, 2, ARRAY['wifi','klima','bazen','parking','roštilj'], 'smart_lock',
      'Kamena vila s bazenom, idealna za porodice i grupe.',
      E'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=70&auto=format')
  ON CONFLICT (asset_id) DO NOTHING;

  INSERT INTO public.rental_pricing (id, restaurant_id, asset_id, date_from, date_to, price) VALUES
    ('deadbeef-0000-0000-0000-0000000e0021', r, a1, CURRENT_DATE - 10, CURRENT_DATE + 120, 85.00),
    ('deadbeef-0000-0000-0000-0000000e0022', r, a2, CURRENT_DATE - 10, CURRENT_DATE + 120, 240.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_bookings
    (id, restaurant_id, asset_id, source, start_date, end_date, guest_name, guest_email, guest_phone,
     base_total, cleaning_fee, deposit, total_amount, payment_status, status)
  VALUES
    ('deadbeef-0000-0000-0000-0000000e0031', r, a2, 'booking', CURRENT_DATE + 20, CURRENT_DATE + 25,
     'Petar Nikolić', 'petar.demo@example.com', '+382 69 100 200',
     1200.00, 50.00, 387.00, 1290.00, 'partial', 'confirmed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_accommodation_stays (booking_id, adults, children, tourist_tax)
  VALUES ('deadbeef-0000-0000-0000-0000000e0031', 6, 2, 40.00)
  ON CONFLICT (booking_id) DO NOTHING;
END;
$$;

-- Primijeni na demo (reset briše+reseeduje sa slikama).
SELECT public.reset_demo_tenant();
