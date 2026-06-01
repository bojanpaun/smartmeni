-- Fix: get_available_rooms — koristiti room_types.base_price umjesto rate_plans
-- rate_plans tabela nema room_type_id kolonu; JOIN je uvijek vraćao 0 redova.
-- Ispravno rješenje: cijena dolazi iz room_types.base_price per tipu sobe.

DROP FUNCTION IF EXISTS get_available_rooms(UUID, DATE, DATE, BIGINT);

CREATE OR REPLACE FUNCTION get_available_rooms(
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE,
  p_adults        BIGINT DEFAULT 1
)
RETURNS TABLE (
  room_type_id    UUID,
  name            TEXT,
  description     TEXT,
  max_occupancy   INT,
  amenities       JSONB,
  images          JSONB,
  available_count INT,
  price_per_night NUMERIC,
  total_price     NUMERIC,
  nights          INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
BEGIN
  IF v_nights <= 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    rt.id,
    rt.name,
    rt.description,
    rt.max_occupancy,
    COALESCE(rt.amenities, '[]'::JSONB),
    COALESCE(rt.images,    '[]'::JSONB),
    MIN(ra.available_rooms)::INT,
    rt.base_price,
    rt.base_price * v_nights,
    v_nights
  FROM room_types rt
  JOIN room_availability ra ON ra.room_type_id = rt.id
  WHERE rt.restaurant_id   = p_restaurant_id
    AND rt.max_occupancy   >= p_adults
    AND rt.is_active       = true
    AND rt.base_price      IS NOT NULL
    AND ra.date            >= p_check_in
    AND ra.date            < p_check_out
    AND ra.available_rooms > 0
    AND ra.stop_sell       = false
  GROUP BY rt.id, rt.name, rt.description, rt.max_occupancy,
           rt.amenities, rt.images, rt.base_price
  HAVING COUNT(DISTINCT ra.date) = v_nights
  ORDER BY rt.base_price ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO authenticated;
