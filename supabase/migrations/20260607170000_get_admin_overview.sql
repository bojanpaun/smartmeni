-- ============================================================================
-- get_admin_overview(restaurant_id) — sve dashboard brojke u JEDNOM round-tripu
-- ----------------------------------------------------------------------------
-- ControlPanel je slao 11, useKitchenCounts 9 zasebnih count-upita → ~20
-- konekcija po učitavanju /admin, što je gušilo Supabase pooler (Nano) i pravilo
-- TTFB od sekundi. Ovaj RPC vraća sve te brojke odjednom (par internih skenova,
-- jedna konekcija). SECURITY DEFINER uz eksplicitnu provjeru pristupa.
--
-- Vraća JSONB sa svim poljima; klijent uzima šta mu treba.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_overview(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today      DATE := (now() AT TIME ZONE 'UTC')::date;
  v_day_start  TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_orders     RECORD;
  v_waiter_req INT;
  v_house      INT;
  v_maint      INT;
  v_hotel      RECORD;
  v_total_rooms INT := 0;
  v_free_rooms  INT := 0;
  v_spa        INT := 0;
BEGIN
  -- Pristup: vlasnik, aktivni staff, ili superadmin.
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup ovom restoranu';
  END IF;

  -- Narudžbe — sve metrike u jednom skenu.
  SELECT
    count(*) FILTER (WHERE created_at >= v_day_start)                                         AS orders_today,
    coalesce(sum(total) FILTER (WHERE created_at >= v_day_start
             AND status NOT IN ('cancelled','closed')), 0)                                    AS revenue_today,
    count(*) FILTER (WHERE status IN ('pending','received','ready'))                          AS waiter,
    count(*) FILTER (WHERE kitchen_status = 'preparing' AND status NOT IN ('served','closed')) AS kitchen,
    count(*) FILTER (WHERE bar_status = 'preparing' AND status NOT IN ('served','closed'))    AS bar
  INTO v_orders
  FROM orders WHERE restaurant_id = p_restaurant_id;

  SELECT count(*) INTO v_waiter_req FROM waiter_requests
    WHERE restaurant_id = p_restaurant_id AND is_resolved = false;

  SELECT count(*) INTO v_house FROM housekeeping_tasks
    WHERE restaurant_id = p_restaurant_id
      AND status IN ('pending','in_progress','done') AND scheduled_for = v_today;

  SELECT count(*) INTO v_maint FROM maintenance_requests
    WHERE restaurant_id = p_restaurant_id AND status NOT IN ('verified','resolved');

  SELECT
    count(*) FILTER (WHERE status = 'inquiry' AND check_out_date >= v_today)              AS inquiry,
    count(*) FILTER (WHERE status = 'confirmed' AND check_in_date = v_today)              AS arrivals,
    count(*) FILTER (WHERE status = 'checked_in' AND check_out_date = v_today)            AS departures,
    count(*) FILTER (WHERE status = 'checked_in')                                         AS checked_in_now,
    count(*) FILTER (WHERE check_in_date = v_today AND status IN ('confirmed','checked_in')) AS checkins_today
  INTO v_hotel
  FROM hotel_reservations WHERE restaurant_id = p_restaurant_id;

  SELECT count(*), count(*) FILTER (WHERE status = 'available')
    INTO v_total_rooms, v_free_rooms
    FROM rooms WHERE restaurant_id = p_restaurant_id;

  SELECT count(*) INTO v_spa FROM spa_appointments
    WHERE restaurant_id = p_restaurant_id AND appointment_date = v_today
      AND status NOT IN ('cancelled','no_show');

  RETURN jsonb_build_object(
    'orders_today',    coalesce(v_orders.orders_today, 0),
    'revenue_today',   coalesce(v_orders.revenue_today, 0),
    'waiter',          coalesce(v_orders.waiter, 0),
    'kitchen',         coalesce(v_orders.kitchen, 0),
    'bar',             coalesce(v_orders.bar, 0),
    'waiter_req',      coalesce(v_waiter_req, 0),
    'housekeeping',    coalesce(v_house, 0),
    'maint_open',      coalesce(v_maint, 0),
    'hotel_inquiry',   coalesce(v_hotel.inquiry, 0),
    'hotel_arrivals',  coalesce(v_hotel.arrivals, 0),
    'hotel_departures',coalesce(v_hotel.departures, 0),
    'checked_in_now',  coalesce(v_hotel.checked_in_now, 0),
    'checkins_today',  coalesce(v_hotel.checkins_today, 0),
    'total_rooms',     coalesce(v_total_rooms, 0),
    'free_rooms',      coalesce(v_free_rooms, 0),
    'spa_today',       coalesce(v_spa, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_admin_overview(UUID) IS
  'Sve /admin dashboard brojke u jednom pozivu (rasterećuje pooler). Pristup: vlasnik/staff/superadmin.';
