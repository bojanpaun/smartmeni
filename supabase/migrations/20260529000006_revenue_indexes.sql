-- ================================================================
-- Faza 5: Revenue Management — indeksi za performanse
-- ================================================================

-- Partial index koji pokriva WHERE klauzulu hotel_daily_revenue viewa
-- i sve upite po restaurant_id + check_in_date rasponu
CREATE INDEX IF NOT EXISTS idx_hotel_res_revenue
  ON hotel_reservations (restaurant_id, check_in_date)
  WHERE status NOT IN ('cancelled', 'no_show')
    AND check_in_date IS NOT NULL;

-- Indeks za upcoming rezervacije (check_in_date range + restaurant_id)
CREATE INDEX IF NOT EXISTS idx_hotel_res_upcoming
  ON hotel_reservations (restaurant_id, check_in_date, check_out_date)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Indeks za status filter koji se koristi u triggerima i upitima
CREATE INDEX IF NOT EXISTS idx_hotel_res_status
  ON hotel_reservations (restaurant_id, status);
