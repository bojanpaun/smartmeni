-- ================================================================
-- Faza 5: Revenue Management
-- View: hotel_daily_revenue — per-day KPI agregacija
-- ================================================================

CREATE OR REPLACE VIEW hotel_daily_revenue AS
SELECT
  hr.restaurant_id,
  hr.check_in_date                              AS date,
  COUNT(DISTINCT hr.id)                         AS reservations_count,
  COALESCE(SUM(hr.total_amount),    0)          AS total_revenue,
  COALESCE(AVG(hr.rate_per_night),  0)          AS adr,
  COALESCE(SUM(
    hr.check_out_date - hr.check_in_date
  ), 0)::INT                                    AS room_nights_sold,
  COALESCE(AVG(
    hr.check_out_date - hr.check_in_date
  ), 0)                                         AS avg_los
FROM hotel_reservations hr
WHERE hr.status NOT IN ('cancelled', 'no_show')
  AND hr.check_in_date IS NOT NULL
GROUP BY hr.restaurant_id, hr.check_in_date;

-- Pristup za authenticated korisnike
GRANT SELECT ON hotel_daily_revenue TO authenticated;
