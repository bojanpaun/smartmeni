-- ============================================================================
-- Novi detektori za „Početni koraci" checklist (zalihe, dobavljači, hotel sobe/
-- tipovi soba, meni kategorije, spa usluge).
-- ----------------------------------------------------------------------------
-- 1) get_admin_overview v4: +5 brojki (inventory_items_count, suppliers_count,
--    room_types_count, categories_count, spa_services_count). „rooms" detektor
--    koristi postojeći total_rooms — bez nove brojke.
-- 2) dashboard_checklist_steps.detect_key CHECK proširen novim vrijednostima
--    (migracije nepromjenjive → DROP+ADD u novoj migraciji).
-- Sve nove brojke su jeftin COUNT po restaurant_id (indeksirano); inventory_items
-- se broji u istom skenu kao low_stock (bez dodatnog prolaza).
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
  v_menu_items INT := 0;
  v_tables     INT := 0;
  v_staff      INT := 0;
  v_inv_items  INT := 0;
  v_suppliers  INT := 0;
  v_room_types INT := 0;
  v_categories INT := 0;
  v_spa_svc    INT := 0;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup ovom restoranu';
  END IF;

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

  -- Zalihe: ukupno stavki + onih ispod minimuma — jedan sken.
  SELECT count(*), count(*) FILTER (WHERE min_quantity > 0 AND quantity <= min_quantity)
    INTO v_inv_items, v_low_stock
    FROM inventory_items WHERE restaurant_id = p_restaurant_id;

  SELECT
    count(*) FILTER (WHERE created_at >= v_day_start) AS new_today,
    count(*)                                          AS total
  INTO v_guests
  FROM guests WHERE restaurant_id = p_restaurant_id;

  SELECT count(*) INTO v_res_today FROM reservations
    WHERE restaurant_id = p_restaurant_id AND date = v_today AND status <> 'cancelled';

  -- v3/v4: brojke za „Početni koraci" detekciju.
  SELECT count(*) INTO v_menu_items FROM menu_items WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_tables     FROM tables     WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_staff      FROM staff      WHERE restaurant_id = p_restaurant_id AND is_active = true;
  SELECT count(*) INTO v_suppliers  FROM suppliers  WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_room_types FROM room_types WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_categories FROM categories WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_spa_svc    FROM spa_services WHERE restaurant_id = p_restaurant_id;

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
    'reservations_today', coalesce(v_res_today, 0),
    'menu_items_count',   coalesce(v_menu_items, 0),
    'tables_count',       coalesce(v_tables, 0),
    'staff_count',        coalesce(v_staff, 0),
    'inventory_items_count', coalesce(v_inv_items, 0),
    'suppliers_count',       coalesce(v_suppliers, 0),
    'room_types_count',      coalesce(v_room_types, 0),
    'categories_count',      coalesce(v_categories, 0),
    'spa_services_count',    coalesce(v_spa_svc, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_admin_overview(UUID) IS
  'Sve /admin dashboard brojke u jednom pozivu. Pristup: vlasnik/staff/superadmin. v4: +inventory_items/suppliers/room_types/categories/spa_services count (Početni koraci detektori).';

-- ── Proširi dozvoljene detect_key vrijednosti ───────────────────────────────
ALTER TABLE public.dashboard_checklist_steps
  DROP CONSTRAINT IF EXISTS dashboard_checklist_detect_chk;
ALTER TABLE public.dashboard_checklist_steps
  ADD CONSTRAINT dashboard_checklist_detect_chk
  CHECK (detect_key IS NULL OR detect_key IN (
    'logo','menu','tables','staff',
    'inventory','suppliers','rooms','room_types','categories','spa_services'
  ));
