-- ================================================================
-- Fix: get_room_packages — provjera dostupnosti specificnih soba
--
-- Problem: r.status = 'available' je previše strogo.
-- Soba može biti 'occupied' ili 'cleaning' (trenutni gost) ali
-- je i dalje slobodna za BUDUĆE rezervacije.
-- Jedina relevantna provjera za buduće bookinge su kolizije u
-- hotel_reservations. 'maintenance' i 'blocked' jedini su statusi
-- koji znače "soba nije dostupna za booking".
-- ================================================================

DROP FUNCTION IF EXISTS get_room_packages(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_room_packages(
  p_room_type_id  UUID,
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE
)
RETURNS TABLE (
  rate_plan_id        UUID,
  plan_name           TEXT,
  plan_description    TEXT,
  price_per_night     NUMERIC,
  total_price         NUMERIC,
  nights              INT,
  cancellation_policy TEXT,
  min_stay            INT,
  payment_type        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
  v_mult   NUMERIC;
BEGIN
  SELECT COALESCE(
    (SELECT rp0.multiplier
     FROM rate_plans rp0
     WHERE rp0.restaurant_id = p_restaurant_id
       AND rp0.plan_type     = 'seasonal'
       AND rp0.is_active     = true
       AND (rp0.applies_from  IS NULL OR rp0.applies_from  <= p_check_in)
       AND (rp0.applies_until IS NULL OR rp0.applies_until >= p_check_out)
     ORDER BY rp0.multiplier DESC
     LIMIT 1),
    1.0
  ) INTO v_mult;

  RETURN QUERY
  SELECT
    rp.id,
    rp.name,
    rp.description,
    ROUND(rp.price_per_night * v_mult, 2),
    ROUND(rp.price_per_night * v_mult * v_nights, 2),
    v_nights,
    rp.cancellation_policy,
    rp.min_stay,
    rp.payment_type
  FROM rate_plans rp
  WHERE rp.room_type_id  = p_room_type_id
    AND rp.restaurant_id = p_restaurant_id
    AND rp.plan_type     = 'package'
    AND rp.is_active     = true
    AND rp.min_stay      <= v_nights
    AND (
      -- Plan bez specificnih soba → dostupan (room_type nivo vec provjeren)
      NOT EXISTS (
        SELECT 1 FROM rate_plan_rooms rpr
        WHERE rpr.rate_plan_id = rp.id
      )
      OR
      -- Plan sa specificnim sobama → barem jedna nije u maintenance/blocked
      -- i nema potvrđene kolizije rezervacije za traženi period
      EXISTS (
        SELECT 1
        FROM rate_plan_rooms rpr
        JOIN rooms r ON r.id = rpr.room_id
        WHERE rpr.rate_plan_id = rp.id
          -- 'occupied'/'cleaning' = trenutni gost, soba i dalje bookable
          AND r.status NOT IN ('maintenance', 'blocked')
          AND NOT EXISTS (
            SELECT 1 FROM hotel_reservations hr
            WHERE hr.room_id         = r.id
              AND hr.status         NOT IN ('cancelled', 'no_show')
              AND hr.check_in_date  < p_check_out
              AND hr.check_out_date > p_check_in
          )
      )
    )
  ORDER BY rp.price_per_night ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO authenticated;
