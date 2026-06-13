-- ============================================================================
-- Prilagodljivi dashboard KPI-evi (per-korisnik) + proširen get_admin_overview
-- ----------------------------------------------------------------------------
-- 1) user_profiles.dashboard_kpis: lista ključeva KPI-eva koje je korisnik izabrao
--    da vidi na /admin dashboardu. NULL = podrazumijevani set (vidi ControlPanel).
--    RLS već postoji: "Korisnik ažurira/vidi svoj profil" (FOR UPDATE/SELECT
--    USING auth.uid()=id) — korisnik sam upravlja svojim izborom, bez nove politike.
-- 2) get_admin_overview dobija 5 novih polja (inventory/guests/tables/analytics)
--    da katalog KPI-eva pokrije i te module. Migracije su nepromjenjive → RPC se
--    mijenja kroz CREATE OR REPLACE u novoj migraciji (ne edituje se stara).
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS dashboard_kpis text[];

COMMENT ON COLUMN public.user_profiles.dashboard_kpis IS
  'Ključevi KPI-eva izabranih za /admin dashboard (per-korisnik). NULL = default set.';

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
  v_week_start TIMESTAMPTZ := (((now() AT TIME ZONE 'UTC')::date - 6)::timestamp) AT TIME ZONE 'UTC';
  v_orders     RECORD;
  v_waiter_req INT;
  v_house      INT;
  v_maint      INT;
  v_hotel      RECORD;
  v_total_rooms INT := 0;
  v_free_rooms  INT := 0;
  v_spa        INT := 0;
  v_low_stock  INT := 0;
  v_guests     RECORD;
  v_res_today  INT := 0;
BEGIN
  -- Pristup: vlasnik, aktivni staff, ili superadmin.
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup ovom restoranu';
  END IF;

  -- Narudžbe — sve metrike u jednom skenu (uklj. promet zadnjih 7 dana).
  SELECT
    count(*) FILTER (WHERE created_at >= v_day_start)                                         AS orders_today,
    coalesce(sum(total) FILTER (WHERE created_at >= v_day_start
             AND status NOT IN ('cancelled','closed')), 0)                                    AS revenue_today,
    coalesce(sum(total) FILTER (WHERE created_at >= v_week_start
             AND status NOT IN ('cancelled','closed')), 0)                                    AS revenue_week,
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

  -- Inventar: stavke ispod (ili na) minimuma (samo gdje je minimum postavljen).
  SELECT count(*) INTO v_low_stock FROM inventory_items
    WHERE restaurant_id = p_restaurant_id AND min_quantity > 0 AND quantity <= min_quantity;

  -- Gosti: novi danas + ukupno.
  SELECT
    count(*) FILTER (WHERE created_at >= v_day_start) AS new_today,
    count(*)                                          AS total
  INTO v_guests
  FROM guests WHERE restaurant_id = p_restaurant_id;

  -- Rezervacije stolova danas (osim otkazanih).
  SELECT count(*) INTO v_res_today FROM reservations
    WHERE restaurant_id = p_restaurant_id AND date = v_today AND status <> 'cancelled';

  RETURN jsonb_build_object(
    'orders_today',    coalesce(v_orders.orders_today, 0),
    'revenue_today',   coalesce(v_orders.revenue_today, 0),
    'revenue_week',    coalesce(v_orders.revenue_week, 0),
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
    'spa_today',       coalesce(v_spa, 0),
    'low_stock',       coalesce(v_low_stock, 0),
    'new_guests_today',coalesce(v_guests.new_today, 0),
    'total_guests',    coalesce(v_guests.total, 0),
    'reservations_today', coalesce(v_res_today, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_admin_overview(UUID) IS
  'Sve /admin dashboard brojke u jednom pozivu (rasterećuje pooler). Pristup: vlasnik/staff/superadmin. v2: +revenue_week/low_stock/new_guests_today/total_guests/reservations_today.';
