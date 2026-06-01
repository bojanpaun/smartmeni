-- Fix: get_available_rooms — price_per_night ambiguous column reference
-- CTE best_rate koristio nekvalikovani price_per_night koji je RETURNS TABLE OUT parametar.
-- Rješenje: tabela alias rp u CTE-u + kvalifikovane kolone.

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
  WITH best_rate AS (
    SELECT DISTINCT ON (rp.room_type_id)
      rp.room_type_id,
      rp.price_per_night,
      rp.min_stay
    FROM rate_plans rp
    WHERE rp.restaurant_id = p_restaurant_id
      AND rp.is_active = true
    ORDER BY rp.room_type_id, rp.price_per_night ASC
  )
  SELECT
    rt.id,
    rt.name,
    rt.description,
    rt.max_occupancy,
    COALESCE(rt.amenities, '[]'::JSONB),
    COALESCE(rt.images,    '[]'::JSONB),
    MIN(ra.available_rooms)::INT,
    br.price_per_night,
    br.price_per_night * v_nights,
    v_nights
  FROM room_types rt
  JOIN room_availability ra ON ra.room_type_id = rt.id
  JOIN best_rate br ON br.room_type_id = rt.id
  WHERE rt.restaurant_id  = p_restaurant_id
    AND rt.max_occupancy  >= p_adults
    AND rt.is_active      = true
    AND ra.date           >= p_check_in
    AND ra.date           < p_check_out
    AND ra.available_rooms > 0
    AND ra.stop_sell      = false
    AND br.min_stay       <= v_nights
  GROUP BY rt.id, rt.name, rt.description, rt.max_occupancy,
           rt.amenities, rt.images, br.price_per_night
  HAVING COUNT(DISTINCT ra.date) = v_nights
  ORDER BY br.price_per_night ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO authenticated;
