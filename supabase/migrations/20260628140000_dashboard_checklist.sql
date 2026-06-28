-- ============================================================================
-- Dashboard „Početni koraci" checklist (Faza 2 task-trake redizajna)
-- ----------------------------------------------------------------------------
-- 1) get_admin_overview v3: +3 polja za DETEKCIJU statusa koraka
--    (menu_items_count / tables_count / staff_count) — bez novog round-tripa,
--    checklist čita iste brojke kao ostatak dashboarda.
-- 2) user_profiles.onboarding_checklist jsonb: per-korisnik RUČNE oznake završenih
--    koraka (lista step id-jeva) za korake bez pouzdane detekcije (QR, fiskalizacija).
--    Isti pattern kao dashboard_kpis; RLS „korisnik ažurira svoj profil" već postoji.
-- 3) dashboard_checklist_steps: konfigurabilni koraci (superadmin kurira na
--    /superadmin/dashboard, tab „Početni koraci"). detect_key bira koji detektor u
--    kodu računa `done` (logo/menu/tables/staff); NULL = ručni korak. Gating po
--    vertical/perm/addon kao dashboard_tasks. Labela=izvor me; prevod kroz
--    library_translations (entity_type='dashboard_checklist').
-- ============================================================================

-- ── 1) get_admin_overview v3 ────────────────────────────────────────────────
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
BEGIN
  -- Pristup: vlasnik, aktivni staff, ili superadmin.
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

  SELECT count(*) INTO v_low_stock FROM inventory_items
    WHERE restaurant_id = p_restaurant_id AND min_quantity > 0 AND quantity <= min_quantity;

  SELECT
    count(*) FILTER (WHERE created_at >= v_day_start) AS new_today,
    count(*)                                          AS total
  INTO v_guests
  FROM guests WHERE restaurant_id = p_restaurant_id;

  SELECT count(*) INTO v_res_today FROM reservations
    WHERE restaurant_id = p_restaurant_id AND date = v_today AND status <> 'cancelled';

  -- v3: brojke za „Početni koraci" checklist (detekcija).
  SELECT count(*) INTO v_menu_items FROM menu_items WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_tables     FROM tables     WHERE restaurant_id = p_restaurant_id;
  SELECT count(*) INTO v_staff      FROM staff      WHERE restaurant_id = p_restaurant_id AND is_active = true;

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
    'menu_items_count', coalesce(v_menu_items, 0),
    'tables_count',     coalesce(v_tables, 0),
    'staff_count',      coalesce(v_staff, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_admin_overview(UUID) IS
  'Sve /admin dashboard brojke u jednom pozivu. Pristup: vlasnik/staff/superadmin. v3: +menu_items_count/tables_count/staff_count (za Početni koraci checklist).';

-- ── 2) Per-korisnik ručne oznake završenih koraka ───────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_profiles.onboarding_checklist IS
  'Lista step id-jeva (dashboard_checklist_steps) koje je korisnik RUČNO označio završenim (koraci bez pouzdane detekcije). Per-korisnik, kao dashboard_kpis.';

-- ── 3) Konfigurabilni koraci ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_checklist_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order  int        NOT NULL DEFAULT 0,
  icon        text       NOT NULL DEFAULT '✅',
  label       text       NOT NULL,            -- izvor 'me'
  path        text       NOT NULL,
  detect_key  text,                           -- 'logo'|'menu'|'tables'|'staff' | NULL (ručno)
  vertical    text,                           -- gating (nullable)
  perm        text,                           -- gating (nullable)
  addon       text,                           -- gating (nullable)
  is_active   boolean    NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT dashboard_checklist_detect_chk
    CHECK (detect_key IS NULL OR detect_key IN ('logo','menu','tables','staff'))
);

COMMENT ON TABLE public.dashboard_checklist_steps IS
  'Konfigurabilni „Početni koraci" na admin početnoj. Globalno (superadmin kurira /superadmin/dashboard). detect_key → detektor u kodu računa done; NULL=ručna oznaka (user_profiles.onboarding_checklist). Prevodi: library_translations (entity_type=dashboard_checklist).';

CREATE INDEX IF NOT EXISTS idx_dashboard_checklist_active
  ON public.dashboard_checklist_steps (is_active, sort_order);

ALTER TABLE public.dashboard_checklist_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dashboard koraci čitljivi prijavljenima"
  ON public.dashboard_checklist_steps FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Superadmin upravlja dashboard koracima"
  ON public.dashboard_checklist_steps FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER dashboard_checklist_steps_updated_at
  BEFORE UPDATE ON public.dashboard_checklist_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Početni set (6 koraka). Logo i radnici se tiču svih vertikala (vertical NULL);
-- meni/stolovi/QR su restoran; fiskalizacija iza addon-a.
INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key, vertical, perm, addon) VALUES
  (10, '🖼️', 'Postavi logo',          '/admin/settings/brand',          'logo',   NULL,         NULL, NULL),
  (20, '🍽️', 'Dodaj prvo jelo',       '/admin/menu',                    'menu',   'restaurant', NULL, NULL),
  (30, '🪑', 'Napravi raspored stolova','/admin/tables',                 'tables', 'restaurant', NULL, NULL),
  (40, '👤', 'Dodaj radnika',          '/admin/hr/staff',                'staff',  NULL,         NULL, NULL),
  (50, '📱', 'Odštampaj QR kod',       '/admin/menu/qr',                 NULL,     'restaurant', NULL, NULL),
  (60, '🧾', 'Podesi fiskalizaciju',   '/admin/settings/fiscalization',  NULL,     NULL,         NULL, 'fiscalization');
