-- ================================================================
-- Faza 5: Revenue Management — SQL funkcija umjesto aggregate viewa
--
-- Problem: PostgreSQL ne može gurnuti predicate (WHERE date >= x)
-- u aggregate view (GROUP BY) pa uvijek skenira cijelu tabelu.
-- Funkcija prima date range kao parametre → direktan index scan.
-- ================================================================

CREATE OR REPLACE FUNCTION get_daily_revenue(
  p_restaurant_id UUID,
  p_from          DATE,
  p_to            DATE
)
RETURNS TABLE (
  date                DATE,
  reservations_count  BIGINT,
  total_revenue       NUMERIC,
  adr                 NUMERIC,
  room_nights_sold    INT,
  avg_los             NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hr.check_in_date                                          AS date,
    COUNT(*)                                                  AS reservations_count,
    COALESCE(SUM(hr.total_amount),    0)                      AS total_revenue,
    COALESCE(AVG(hr.rate_per_night),  0)                      AS adr,
    COALESCE(SUM(hr.check_out_date - hr.check_in_date), 0)::INT AS room_nights_sold,
    COALESCE(AVG(hr.check_out_date - hr.check_in_date), 0)    AS avg_los
  FROM hotel_reservations hr
  WHERE hr.restaurant_id  = p_restaurant_id
    AND hr.check_in_date >= p_from
    AND hr.check_in_date <= p_to
    AND hr.status NOT IN ('cancelled', 'no_show')
    AND hr.check_in_date IS NOT NULL
  GROUP BY hr.check_in_date
  ORDER BY hr.check_in_date;
$$;

GRANT EXECUTE ON FUNCTION get_daily_revenue(UUID, DATE, DATE) TO authenticated;
