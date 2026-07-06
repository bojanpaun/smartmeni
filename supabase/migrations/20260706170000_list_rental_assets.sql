-- ============================================================================
-- RENT hub — anon RPC list_rental_assets: KATALOG svih aktivnih smještaja tenanta
-- (BEZ datuma/availability/quote), za marketing izlog na rental landing hub-u
-- (/:slug/rentals). Availability se provjerava tek na /rent booking-u.
-- Gejt: rental vertikala + status active + asset_kind accommodation. GRANT anon.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_rental_assets(p_restaurant_id uuid)
RETURNS TABLE (
  asset_id      uuid,
  name          text,
  description   text,
  location_name text,
  city          text,
  base_price    numeric,
  pricing_unit  text,
  cleaning_fee  numeric,
  min_duration  int,
  max_guests    int,
  bedrooms      int,
  beds          int,
  bathrooms     int,
  amenities     text[],
  photos        text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id, a.name, d.description, loc.name, loc.city,
    a.base_price, COALESCE(a.pricing_unit, 'night'), COALESCE(a.cleaning_fee, 0), COALESCE(a.min_duration, 1),
    d.max_guests, d.bedrooms, d.beds, d.bathrooms, COALESCE(d.amenities, '{}'),
    ARRAY(
      SELECT btrim(u) FROM unnest(string_to_array(COALESCE(d.photo_urls, ''), E'\n'))
             WITH ORDINALITY AS x(u, ord)
      WHERE btrim(u) ~ '^https?://'
      ORDER BY ord
    )
  FROM rental_assets a
  JOIN restaurants r ON r.id = a.restaurant_id AND 'rental' = ANY(r.active_verticals)
  LEFT JOIN rental_accommodation_details d ON d.asset_id = a.id
  LEFT JOIN rental_locations loc ON loc.id = a.location_id
  WHERE a.restaurant_id = p_restaurant_id
    AND a.status = 'active'
    AND a.asset_kind = 'accommodation'
  ORDER BY a.base_price NULLS LAST, a.name;
$$;

COMMENT ON FUNCTION public.list_rental_assets(uuid) IS
  'RENT hub: anon katalog svih aktivnih smještaja tenanta (bez datuma) za marketing izlog. Gejt: rental vertikala + status active.';

GRANT EXECUTE ON FUNCTION public.list_rental_assets(uuid) TO anon, authenticated;
