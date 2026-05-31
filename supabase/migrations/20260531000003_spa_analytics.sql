-- ============================================================
-- Faza 8.5.E — Spa analitika view
-- ============================================================

CREATE OR REPLACE VIEW spa_analytics_monthly AS
SELECT
  a.restaurant_id,
  DATE_TRUNC('month', a.appointment_date)::DATE            AS month,
  s.name                                                   AS service_name,
  s.category                                               AS service_category,
  COUNT(*)                                                 AS total_appointments,
  COUNT(CASE WHEN a.status = 'completed'  THEN 1 END)      AS completed,
  COUNT(CASE WHEN a.status = 'no_show'    THEN 1 END)      AS no_shows,
  COUNT(CASE WHEN a.status = 'cancelled'  THEN 1 END)      AS cancelled,
  SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) AS revenue,
  AVG(CASE WHEN a.status = 'completed' THEN a.price END)   AS avg_price,
  COUNT(CASE WHEN a.hotel_reservation_id IS NOT NULL THEN 1 END) AS hotel_guests,
  COUNT(CASE WHEN a.hotel_reservation_id IS NULL     THEN 1 END) AS external_guests,
  SUM(CASE WHEN a.status = 'completed' THEN a.duration_minutes ELSE 0 END) AS total_minutes
FROM spa_appointments a
JOIN spa_services s ON s.id = a.service_id
GROUP BY a.restaurant_id, DATE_TRUNC('month', a.appointment_date), s.name, s.category;

-- RLS: view nasljeđuje RLS od spa_appointments, ali zbog VIEW-a
-- dodajemo grant samo za authenticated
GRANT SELECT ON spa_analytics_monthly TO authenticated;
