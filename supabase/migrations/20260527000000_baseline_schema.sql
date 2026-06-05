-- ============================================================================
-- BASELINE ŠEMA — bazne (legacy) tabele platforme/restorana
-- ----------------------------------------------------------------------------
-- Generisano iz prod dumpa (supabase/_remote_schema_snapshot.sql) skriptom
-- scripts/build_baseline.cjs. Kreira 24 bazne tabele koje NIJEDNA migracija ne
-- kreira (restaurants, staff, guests, orders, menu_items, ...), a koje sve
-- migracije od 20260528 nadalje pretpostavljaju da postoje. Bez ovoga
-- 'supabase db reset' / 'supabase test db' pucaju na FK ka nepostojećim tabelama.
--
-- As-of-20260528: orders.folio_id je IZOSTAVLJEN (dodaje ga 20260528000005 sa
-- FK na folios); kitchen_status/bar_status/categories.is_bar su zadržani jer ih
-- kasnije migracije dodaju idempotentno (ADD COLUMN IF NOT EXISTS).
--
-- Event trigger 'rls_auto_enable' ne postoji lokalno → RLS uključujemo eksplicitno.
-- NE EDITOVATI RUČNO — regeneriši skriptom ako treba.
-- ============================================================================

SET check_function_bodies = false;
SET client_min_messages = warning;

-- Ekstenzije koje su u prod-u predinstalirane (Supabase managed). Lokalno/CI ih
-- moramo eksplicitno uključiti da kasnije cron/net migracije (spa reminder) prođu.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ── Funkcije ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."deduct_inventory_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
    FOR item IN
      SELECT mii.inventory_item_id, mii.quantity AS qty_per_portion,
             ii.quantity AS current_qty, ii.restaurant_id
      FROM order_items oi
      JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
      JOIN inventory_items ii ON ii.id = mii.inventory_item_id
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE inventory_items
        SET quantity = GREATEST(0, quantity - item.qty_per_portion), updated_at = NOW()
        WHERE id = item.inventory_item_id;

      INSERT INTO inventory_movements (
        restaurant_id, item_id, type, quantity,
        quantity_before, quantity_after, source, order_id, note
      ) VALUES (
        item.restaurant_id, item.inventory_item_id, 'out', item.qty_per_portion,
        item.current_qty, GREATEST(0, item.current_qty - item.qty_per_portion),
        'order', NEW.id, 'Automatski odbitak — narudžba'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."deduct_inventory_on_order"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."refresh_guest_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE guests SET
    total_visits  = (SELECT COUNT(*) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status NOT IN ('cancelled')),
    total_spent   = (SELECT COALESCE(SUM(amount_spent), 0) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status = 'completed'),
    no_show_count = (SELECT COUNT(*) FROM guest_visits WHERE guest_id = COALESCE(NEW.guest_id, OLD.guest_id) AND status IN ('no_show', 'unpaid'))
  WHERE id = COALESCE(NEW.guest_id, OLD.guest_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION "public"."refresh_guest_stats"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_guest_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

ALTER FUNCTION "public"."update_guest_updated_at"() OWNER TO "postgres";

-- ── Tabele ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "clock_in" timestamp with time zone,
    "clock_out" timestamp with time zone,
    "planned_start" time without time zone,
    "planned_end" time without time zone,
    "hours_worked" numeric(5,2),
    "note" "text",
    "status" "text" DEFAULT 'present'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'late'::"text", 'partial'::"text"])))
);

ALTER TABLE "public"."attendance" OWNER TO "postgres";

COMMENT ON TABLE "public"."attendance" IS 'Evidencija dolazaka — clock in/out po zaposleniku';

CREATE TABLE IF NOT EXISTS "public"."attendance_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "clock_in" timestamp with time zone NOT NULL,
    "clock_out" timestamp with time zone,
    "hours_worked" numeric(5,2),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."attendance_entries" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "name_en" "text",
    "icon" "text" DEFAULT '🍽️'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_bar" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."categories" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."guest_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_id" "uuid",
    "restaurant_id" "uuid",
    "visit_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "table_number" "text",
    "party_size" integer DEFAULT 1,
    "visit_type" "text" DEFAULT 'walk_in'::"text",
    "status" "text" DEFAULT 'completed'::"text",
    "reservation_id" "uuid",
    "amount_spent" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "guest_visits_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'cancelled'::"text", 'no_show'::"text", 'unpaid'::"text"]))),
    CONSTRAINT "guest_visits_visit_type_check" CHECK (("visit_type" = ANY (ARRAY['walk_in'::"text", 'reservation'::"text", 'online'::"text"])))
);

ALTER TABLE "public"."guest_visits" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "phone" "text",
    "email" "text",
    "date_of_birth" "date",
    "avatar_url" "text",
    "status" "text" DEFAULT 'regular'::"text",
    "blacklist_reason" "text",
    "total_visits" integer DEFAULT 0,
    "total_spent" numeric(10,2) DEFAULT 0,
    "no_show_count" integer DEFAULT 0,
    "user_id" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "nationality" "text",
    "document_number" "text",
    "vip_status" boolean DEFAULT false,
    "last_visit_at" timestamp with time zone,
    CONSTRAINT "guests_status_check" CHECK (("status" = ANY (ARRAY['regular'::"text", 'vip'::"text", 'blacklist'::"text", 'pending'::"text"])))
);

ALTER TABLE "public"."guests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'ostalo'::"text",
    "unit" "text" DEFAULT 'kom'::"text",
    "quantity" numeric(10,3) DEFAULT 0,
    "min_quantity" numeric(10,3) DEFAULT 0,
    "cost_per_unit" numeric(10,2),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_items_unit_check" CHECK (("unit" = ANY (ARRAY['kom'::"text", 'kg'::"text", 'g'::"text", 'l'::"text", 'ml'::"text", 'pak'::"text"])))
);

ALTER TABLE "public"."inventory_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "quantity_before" numeric(10,3),
    "quantity_after" numeric(10,3),
    "note" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_movements_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'order'::"text"]))),
    CONSTRAINT "inventory_movements_type_check" CHECK (("type" = ANY (ARRAY['in'::"text", 'out'::"text", 'adjustment'::"text"])))
);

ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."menu_item_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity" numeric(10,3) NOT NULL
);

ALTER TABLE "public"."menu_item_ingredients" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "name_en" "text",
    "description" "text",
    "description_en" "text",
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "emoji" "text" DEFAULT '🍽️'::"text",
    "allergens" "text",
    "calories" integer,
    "prep_time" "text",
    "is_visible" boolean DEFAULT true,
    "is_special" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."menu_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "menu_item_id" "uuid",
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "quantity" integer DEFAULT 1,
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "uuid",
    CONSTRAINT "order_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'preparing'::"text", 'ready'::"text"])))
);

ALTER TABLE "public"."order_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "table_number" "text" NOT NULL,
    "status" "text" DEFAULT 'received'::"text",
    "note" "text",
    "total" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "guest_token" "uuid" DEFAULT "gen_random_uuid"(),
    "guest_id" "uuid",
    "rejection_message" "text",
    "kitchen_status" "text",
    "bar_status" "text",
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'preparing'::"text", 'ready'::"text", 'served'::"text", 'closed'::"text"])))
);

ALTER TABLE "public"."orders" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payroll_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payroll_entries_type_check" CHECK (("type" = ANY (ARRAY['daily'::"text", 'bonus'::"text", 'deduction'::"text", 'overtime'::"text", 'advance'::"text"])))
);

ALTER TABLE "public"."payroll_entries" OWNER TO "postgres";

COMMENT ON TABLE "public"."payroll_entries" IS 'Stavke zarade: dnevnice, bonusi, odbitci, akontacije';

CREATE TABLE IF NOT EXISTS "public"."payroll_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "base_salary" numeric(10,2) DEFAULT 0,
    "daily_total" numeric(10,2) DEFAULT 0,
    "bonus_total" numeric(10,2) DEFAULT 0,
    "deduction_total" numeric(10,2) DEFAULT 0,
    "gross_total" numeric(10,2) DEFAULT 0,
    "hours_worked" numeric(6,2) DEFAULT 0,
    "days_worked" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payroll_periods_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'paid'::"text"])))
);

ALTER TABLE "public"."payroll_periods" OWNER TO "postgres";

COMMENT ON TABLE "public"."payroll_periods" IS 'Obračunati platni listovi po periodu';

CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_id" "uuid",
    "table_number" integer,
    "guest_name" "text" NOT NULL,
    "guest_phone" "text",
    "guest_email" "text",
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "guests_count" integer DEFAULT 2,
    "note" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "source" "text" DEFAULT 'admin'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "guest_id" "uuid",
    CONSTRAINT "reservations_source_check" CHECK (("source" = ANY (ARRAY['admin'::"text", 'online'::"text"]))),
    CONSTRAINT "reservations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text", 'completed'::"text"])))
);

ALTER TABLE "public"."reservations" OWNER TO "postgres";

COMMENT ON TABLE "public"."reservations" IS 'Rezervacije stolova — admin kreira direktno, gosti šalju zahtjeve (ako je online_reservations=true)';

CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "phone" "text",
    "hours" "text",
    "logo_url" "text",
    "color" "text" DEFAULT '#0d7a52'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "template" "text" DEFAULT 'modern_minimal'::"text",
    "onboarding_completed" boolean DEFAULT false,
    "plan" "text" DEFAULT 'starter'::"text",
    "trial_ends_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval),
    "subscription_id" "text",
    "paypal_customer_id" "text",
    "plan_expires_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "is_complimentary" boolean DEFAULT false,
    "complimentary_note" "text",
    "online_reservations" boolean DEFAULT false,
    "waiter_requests_enabled" boolean DEFAULT true,
    "digital_ordering" boolean DEFAULT true,
    "waiter_messages" "jsonb" DEFAULT '[{"en": "Call waiter", "sr": "Pozovi konobara", "icon": "🔔"}, {"en": "Bring the bill", "sr": "Donesi račun", "icon": "🧾"}, {"en": "Bring water", "sr": "Donesi vodu", "icon": "🥤"}, {"en": "Clear the table", "sr": "Skloni prazne tanjire", "icon": "🍽️"}]'::"jsonb",
    "guest_registration_enabled" boolean DEFAULT true,
    "ordering_visibility" "text" DEFAULT 'all'::"text",
    "waiter_visibility" "text" DEFAULT 'all'::"text",
    "reservation_visibility" "text" DEFAULT 'all'::"text",
    "registration_visibility" "text" DEFAULT 'all'::"text",
    "rejection_messages" "jsonb",
    "qr_session_minutes" integer DEFAULT 30,
    "admin_theme" "text" DEFAULT 'green'::"text" NOT NULL,
    "show_booking_button" boolean DEFAULT false,
    "booking_custom_domain" "text",
    "booking_checkin_time" "text" DEFAULT '14:00'::"text",
    "booking_checkout_time" "text" DEFAULT '11:00'::"text",
    "booking_page_title" "text",
    "booking_page_desc" "text",
    "hotel_visibility" "text" DEFAULT 'off'::"text",
    "spa_visibility" "text" DEFAULT 'off'::"text",
    "booking_mode" "text" DEFAULT 'immediate'::"text" NOT NULL,
    CONSTRAINT "restaurants_ordering_visibility_check" CHECK (("ordering_visibility" = ANY (ARRAY['off'::"text", 'registered'::"text", 'all'::"text"]))),
    CONSTRAINT "restaurants_registration_visibility_check" CHECK (("registration_visibility" = ANY (ARRAY['off'::"text", 'registered'::"text", 'all'::"text"]))),
    CONSTRAINT "restaurants_reservation_visibility_check" CHECK (("reservation_visibility" = ANY (ARRAY['off'::"text", 'registered'::"text", 'all'::"text"]))),
    CONSTRAINT "restaurants_waiter_visibility_check" CHECK (("waiter_visibility" = ANY (ARRAY['off'::"text", 'registered'::"text", 'all'::"text"])))
);

ALTER TABLE "public"."restaurants" OWNER TO "postgres";

COMMENT ON COLUMN "public"."restaurants"."description" IS 'Kratki opis restorana vidljiv gostima u meniju';

COMMENT ON COLUMN "public"."restaurants"."is_complimentary" IS 'Super admin može dodijeliti besplatni Pro pristup. Ovaj flag preskače sve billing provjere.';

COMMENT ON COLUMN "public"."restaurants"."complimentary_note" IS 'Razlog za besplatni pristup, npr. "Beta tester", "Partner restoran", "Nagradni period"';

COMMENT ON COLUMN "public"."restaurants"."online_reservations" IS 'Da li restoran prima online rezervacije putem stranice menija';

COMMENT ON COLUMN "public"."restaurants"."waiter_requests_enabled" IS 'Da li gosti mogu pozivati konobara putem guest menija';

CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."roles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "user_id" "uuid",
    "role_id" "uuid",
    "email" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "wage_type" "text" DEFAULT 'monthly'::"text",
    "wage_amount" numeric(10,2) DEFAULT 0,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "date_of_birth" "date",
    "address" "text",
    "avatar_url" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "start_date" "date",
    "end_date" "date",
    "contract_type" "text" DEFAULT 'permanent'::"text",
    "employment_type" "text" DEFAULT 'full_time'::"text",
    "position" "text",
    "notes" "text",
    "bank_account" "text",
    "tax_id" "text",
    "vacation_days_total" integer DEFAULT 20,
    "vacation_days_used" integer DEFAULT 0,
    CONSTRAINT "staff_wage_type_check" CHECK (("wage_type" = ANY (ARRAY['hourly'::"text", 'weekly'::"text", 'monthly'::"text"])))
);

ALTER TABLE "public"."staff" OWNER TO "postgres";

COMMENT ON COLUMN "public"."staff"."wage_type" IS 'Tip plate: hourly=po satu, weekly=sedmično, monthly=mjesečno';

COMMENT ON COLUMN "public"."staff"."wage_amount" IS 'Iznos plate u EUR za odabrani tip';

CREATE TABLE IF NOT EXISTS "public"."staff_absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "restaurant_id" "uuid",
    "absence_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days" integer,
    "notes" "text",
    "approved" boolean,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."staff_absences" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."staff_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "restaurant_id" "uuid",
    "event_type" "text" NOT NULL,
    "description" "text",
    "old_value" "text",
    "new_value" "text",
    "event_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);

ALTER TABLE "public"."staff_history" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."staff_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "role_id" "uuid",
    "email" "text" NOT NULL,
    "token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."staff_invites" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "label" "text",
    "x" double precision DEFAULT 50,
    "y" double precision DEFAULT 50,
    "width" double precision DEFAULT 80,
    "height" double precision DEFAULT 80,
    "shape" "text" DEFAULT 'rect'::"text",
    "seats" integer DEFAULT 4,
    "status" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tables_shape_check" CHECK (("shape" = ANY (ARRAY['rect'::"text", 'circle'::"text"]))),
    CONSTRAINT "tables_status_check" CHECK (("status" = ANY (ARRAY['free'::"text", 'occupied'::"text", 'calling'::"text"])))
);

ALTER TABLE "public"."tables" OWNER TO "postgres";

COMMENT ON TABLE "public"."tables" IS 'Interaktivna mapa stolova restorana — pozicije, oblici i status';

CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "is_superadmin" boolean DEFAULT false,
    "full_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text",
    "whatsapp" "text",
    "viber" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."user_profiles" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_profiles" IS 'Prošireni profili korisnika — ime, kontakt, avatar';

CREATE TABLE IF NOT EXISTS "public"."waiter_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "table_number" "text" NOT NULL,
    "request_type" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "response" "text"
);

ALTER TABLE "public"."waiter_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."work_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'scheduled'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "work_schedules_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'absent'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."work_schedules" OWNER TO "postgres";

COMMENT ON TABLE "public"."work_schedules" IS 'Sedmični rasporedi rada zaposlenih';

-- ── Primarni / Unique ključevi ──────────────────────────────────────────

ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_staff_id_date_key" UNIQUE ("staff_id", "date");

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."guest_visits"
    ADD CONSTRAINT "guest_visits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_menu_item_id_inventory_item_id_key" UNIQUE ("menu_item_id", "inventory_item_id");

ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payroll_periods"
    ADD CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."staff_absences"
    ADD CONSTRAINT "staff_absences_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."staff_invites"
    ADD CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."staff_invites"
    ADD CONSTRAINT "staff_invites_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_restaurant_id_user_id_key" UNIQUE ("restaurant_id", "user_id");

ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."waiter_requests"
    ADD CONSTRAINT "waiter_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id");

-- ── Strani ključevi (samo ka baznim tabelama / auth.users) ───────────────

ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."attendance_entries"
    ADD CONSTRAINT "attendance_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."guest_visits"
    ADD CONSTRAINT "guest_visits_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."guest_visits"
    ADD CONSTRAINT "guest_visits_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."guest_visits"
    ADD CONSTRAINT "guest_visits_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payroll_periods"
    ADD CONSTRAINT "payroll_periods_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payroll_periods"
    ADD CONSTRAINT "payroll_periods_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_absences"
    ADD CONSTRAINT "staff_absences_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_absences"
    ADD CONSTRAINT "staff_absences_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_history"
    ADD CONSTRAINT "staff_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_invites"
    ADD CONSTRAINT "staff_invites_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff_invites"
    ADD CONSTRAINT "staff_invites_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."waiter_requests"
    ADD CONSTRAINT "waiter_requests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;

-- ── Indeksi ─────────────────────────────────────────────────────────────

CREATE INDEX "idx_att_entries_date" ON "public"."attendance_entries" USING "btree" ("date");

CREATE INDEX "idx_att_entries_staff" ON "public"."attendance_entries" USING "btree" ("staff_id");

CREATE INDEX "idx_attendance_date" ON "public"."attendance" USING "btree" ("date");

CREATE INDEX "idx_attendance_entries_staff" ON "public"."attendance_entries" USING "btree" ("staff_id");

CREATE INDEX "idx_attendance_staff" ON "public"."attendance" USING "btree" ("staff_id");

CREATE INDEX "idx_categories_restaurant" ON "public"."categories" USING "btree" ("restaurant_id");

CREATE INDEX "idx_guest_visits_guest" ON "public"."guest_visits" USING "btree" ("guest_id");

CREATE INDEX "idx_guest_visits_restaurant" ON "public"."guest_visits" USING "btree" ("restaurant_id");

CREATE INDEX "idx_guests_restaurant" ON "public"."guests" USING "btree" ("restaurant_id");

CREATE INDEX "idx_inventory_items_restaurant" ON "public"."inventory_items" USING "btree" ("restaurant_id");

CREATE INDEX "idx_inventory_movements_created" ON "public"."inventory_movements" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_inventory_movements_restaurant" ON "public"."inventory_movements" USING "btree" ("restaurant_id");

CREATE INDEX "idx_menu_items_restaurant" ON "public"."menu_items" USING "btree" ("restaurant_id");

CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");

CREATE INDEX "idx_orders_bar_status" ON "public"."orders" USING "btree" ("bar_status");

CREATE INDEX "idx_orders_guest_id" ON "public"."orders" USING "btree" ("guest_id");

CREATE INDEX "idx_orders_guest_token" ON "public"."orders" USING "btree" ("guest_token");

CREATE INDEX "idx_orders_kitchen_status" ON "public"."orders" USING "btree" ("kitchen_status");

CREATE INDEX "idx_orders_restaurant" ON "public"."orders" USING "btree" ("restaurant_id");

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");

CREATE INDEX "idx_orders_table_number" ON "public"."orders" USING "btree" ("table_number");

CREATE INDEX "idx_payroll_entries_staff" ON "public"."payroll_entries" USING "btree" ("staff_id");

CREATE INDEX "idx_payroll_periods_staff" ON "public"."payroll_periods" USING "btree" ("staff_id");

CREATE INDEX "idx_reservations_date" ON "public"."reservations" USING "btree" ("date");

CREATE INDEX "idx_reservations_guest_id" ON "public"."reservations" USING "btree" ("guest_id");

CREATE INDEX "idx_reservations_restaurant" ON "public"."reservations" USING "btree" ("restaurant_id");

CREATE INDEX "idx_reservations_restaurant_id" ON "public"."reservations" USING "btree" ("restaurant_id");

CREATE INDEX "idx_restaurants_is_complimentary" ON "public"."restaurants" USING "btree" ("is_complimentary") WHERE ("is_complimentary" = true);

CREATE INDEX "idx_schedules_date" ON "public"."work_schedules" USING "btree" ("date");

CREATE INDEX "idx_schedules_restaurant" ON "public"."work_schedules" USING "btree" ("restaurant_id");

CREATE INDEX "idx_schedules_staff" ON "public"."work_schedules" USING "btree" ("staff_id");

CREATE INDEX "idx_staff_restaurant" ON "public"."staff" USING "btree" ("restaurant_id");

CREATE INDEX "idx_tables_restaurant_id" ON "public"."tables" USING "btree" ("restaurant_id");

-- ── RLS (eksplicitno uključenje) ─────────────────────────────────────────

ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."attendance_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."guest_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_item_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payroll_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."payroll_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_absences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."waiter_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."work_schedules" ENABLE ROW LEVEL SECURITY;

-- ── RLS politike ────────────────────────────────────────────────────────

CREATE POLICY "Anyone can read tables" ON "public"."tables" FOR SELECT USING (true);

CREATE POLICY "Gost se moze registrovati" ON "public"."guests" FOR INSERT WITH CHECK ((("status" = 'pending'::"text") AND ("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."guest_registration_enabled" = true)))));

CREATE POLICY "Gost vidi vlastiti profil" ON "public"."guests" FOR SELECT USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Gosti kreiraju narudzbe" ON "public"."orders" FOR INSERT WITH CHECK (true);

CREATE POLICY "Gosti kreiraju stavke" ON "public"."order_items" FOR INSERT WITH CHECK (true);

CREATE POLICY "Gosti mogu kreirati narudzbe" ON "public"."orders" FOR INSERT WITH CHECK (true);

CREATE POLICY "Gosti mogu kreirati stavke narudzbe" ON "public"."order_items" FOR INSERT WITH CHECK (true);

CREATE POLICY "Gosti mogu slati zahtjeve" ON "public"."waiter_requests" FOR INSERT WITH CHECK (true);

CREATE POLICY "Javno citanje narudzbi" ON "public"."orders" FOR SELECT USING (true);

CREATE POLICY "Javno citanje stavki" ON "public"."order_items" FOR SELECT USING (true);

CREATE POLICY "Javno kreiranje online rezervacija" ON "public"."reservations" FOR INSERT WITH CHECK (("source" = 'online'::"text"));

CREATE POLICY "Kategorije su javne" ON "public"."categories" FOR SELECT USING (true);

CREATE POLICY "Korisnik ažurira svoj profil" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

CREATE POLICY "Korisnik vidi svoj profil" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "Osoblje upravlja stavkama" ON "public"."order_items" FOR UPDATE USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "order_items"."restaurant_id"))));

CREATE POLICY "Osoblje vidi rezervacije" ON "public"."reservations" FOR SELECT USING (("restaurant_id" IN ( SELECT "staff"."restaurant_id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Osoblje vidi sebe" ON "public"."staff" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Owner manages guests" ON "public"."guests" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Public can read order by id" ON "public"."orders" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Public can read order_items by order" ON "public"."order_items" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Public can read reservations by id" ON "public"."reservations" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Public can read waiter_requests by id" ON "public"."waiter_requests" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Restaurant owner can manage tables" ON "public"."tables" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Restorani su javni za čitanje" ON "public"."restaurants" FOR SELECT USING (true);

CREATE POLICY "Role su vidljive u restoranu" ON "public"."roles" FOR SELECT USING ((("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "roles"."restaurant_id"))) OR ("auth"."uid"() IN ( SELECT "staff"."user_id"
   FROM "public"."staff"
  WHERE ("staff"."restaurant_id" = "roles"."restaurant_id")))));

CREATE POLICY "Staff reads guests" ON "public"."guests" FOR SELECT USING (("restaurant_id" IN ( SELECT "staff"."restaurant_id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Vidljive stavke su javne" ON "public"."menu_items" FOR SELECT USING (("is_visible" = true));

CREATE POLICY "Vlasnik azurira narudzbe" ON "public"."orders" FOR UPDATE USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik ažurira zahtjeve" ON "public"."waiter_requests" FOR UPDATE USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "waiter_requests"."restaurant_id"))));

CREATE POLICY "Vlasnik kreira pozivnice" ON "public"."staff_invites" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "staff_invites"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja dolascima" ON "public"."attendance" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja gostima" ON "public"."guests" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"())))) WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja historijom" ON "public"."staff_history" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja inventarom" ON "public"."inventory_items" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja kategorijama" ON "public"."categories" USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "categories"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja narudzbama" ON "public"."orders" FOR UPDATE USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "orders"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja odsustvima" ON "public"."staff_absences" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja osobljem" ON "public"."staff" USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "staff"."restaurant_id")))) WITH CHECK (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "staff"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja platnim listovima" ON "public"."payroll_periods" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja posjetama" ON "public"."guest_visits" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"())))) WITH CHECK (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja rasporedima" ON "public"."work_schedules" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja recepturama" ON "public"."menu_item_ingredients" USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE ("menu_items"."restaurant_id" IN ( SELECT "restaurants"."id"
           FROM "public"."restaurants"
          WHERE ("restaurants"."user_id" = "auth"."uid"()))))));

CREATE POLICY "Vlasnik upravlja restoranom" ON "public"."restaurants" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Vlasnik upravlja rezervacijama" ON "public"."reservations" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja rolama" ON "public"."roles" USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "roles"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja stavkama" ON "public"."menu_items" USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "menu_items"."restaurant_id"))));

CREATE POLICY "Vlasnik upravlja unosima" ON "public"."attendance_entries" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik upravlja zaradama" ON "public"."payroll_entries" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik vidi narudzbe" ON "public"."orders" FOR SELECT USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik vidi osoblje" ON "public"."staff" FOR SELECT USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "staff"."restaurant_id"))));

CREATE POLICY "Vlasnik vidi pokrete" ON "public"."inventory_movements" USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik vidi pozivnice" ON "public"."staff_invites" FOR SELECT USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "staff_invites"."restaurant_id"))));

CREATE POLICY "Vlasnik vidi profile osoblja" ON "public"."user_profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR ("id" IN ( SELECT "staff"."user_id"
   FROM "public"."staff"
  WHERE ("staff"."restaurant_id" IN ( SELECT "restaurants"."id"
           FROM "public"."restaurants"
          WHERE ("restaurants"."user_id" = "auth"."uid"())))))));

CREATE POLICY "Vlasnik vidi stavke narudzbi" ON "public"."order_items" FOR SELECT USING (("restaurant_id" IN ( SELECT "restaurants"."id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."user_id" = "auth"."uid"()))));

CREATE POLICY "Vlasnik vidi sve stavke" ON "public"."menu_items" FOR SELECT USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "menu_items"."restaurant_id"))));

CREATE POLICY "Vlasnik čita zahtjeve" ON "public"."waiter_requests" FOR SELECT USING (("auth"."uid"() = ( SELECT "restaurants"."user_id"
   FROM "public"."restaurants"
  WHERE ("restaurants"."id" = "waiter_requests"."restaurant_id"))));

CREATE POLICY "Zaposlenik azurira vlastiti dolazak" ON "public"."attendance" FOR UPDATE USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Zaposlenik azurira vlastiti unos" ON "public"."attendance_entries" FOR UPDATE USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Zaposlenik kreira vlastiti dolazak" ON "public"."attendance" FOR INSERT WITH CHECK (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Zaposlenik kreira vlastiti unos" ON "public"."attendance_entries" FOR INSERT WITH CHECK (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE (("staff"."user_id" = "auth"."uid"()) AND ("staff"."is_active" = true)))));

CREATE POLICY "Zaposlenik vidi vlastite dolaske" ON "public"."attendance" FOR SELECT USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));

CREATE POLICY "Zaposlenik vidi vlastite platne listove" ON "public"."payroll_periods" FOR SELECT USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));

CREATE POLICY "Zaposlenik vidi vlastite unose" ON "public"."attendance_entries" FOR SELECT USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));

CREATE POLICY "Zaposlenik vidi vlastite zarade" ON "public"."payroll_entries" FOR SELECT USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));

CREATE POLICY "Zaposlenik vidi vlastiti raspored" ON "public"."work_schedules" FOR SELECT USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));

-- ── Trigeri ─────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER "guest_visits_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."guest_visits" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_guest_stats"();

CREATE OR REPLACE TRIGGER "guests_updated_at" BEFORE UPDATE ON "public"."guests" FOR EACH ROW EXECUTE FUNCTION "public"."update_guest_updated_at"();

CREATE OR REPLACE TRIGGER "trigger_deduct_inventory" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."deduct_inventory_on_order"();

-- ── Grantovi (anon/authenticated/service_role) ──────────────────────────

GRANT ALL ON TABLE "public"."attendance" TO "anon";

GRANT ALL ON TABLE "public"."attendance" TO "authenticated";

GRANT ALL ON TABLE "public"."attendance" TO "service_role";

GRANT ALL ON TABLE "public"."attendance_entries" TO "anon";

GRANT ALL ON TABLE "public"."attendance_entries" TO "authenticated";

GRANT ALL ON TABLE "public"."attendance_entries" TO "service_role";

GRANT ALL ON TABLE "public"."categories" TO "anon";

GRANT ALL ON TABLE "public"."categories" TO "authenticated";

GRANT ALL ON TABLE "public"."categories" TO "service_role";

GRANT ALL ON TABLE "public"."guest_visits" TO "anon";

GRANT ALL ON TABLE "public"."guest_visits" TO "authenticated";

GRANT ALL ON TABLE "public"."guest_visits" TO "service_role";

GRANT ALL ON TABLE "public"."guests" TO "anon";

GRANT ALL ON TABLE "public"."guests" TO "authenticated";

GRANT ALL ON TABLE "public"."guests" TO "service_role";

GRANT ALL ON TABLE "public"."inventory_items" TO "anon";

GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";

GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";

GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";

GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";

GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";

GRANT ALL ON TABLE "public"."menu_item_ingredients" TO "anon";

GRANT ALL ON TABLE "public"."menu_item_ingredients" TO "authenticated";

GRANT ALL ON TABLE "public"."menu_item_ingredients" TO "service_role";

GRANT ALL ON TABLE "public"."menu_items" TO "anon";

GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";

GRANT ALL ON TABLE "public"."menu_items" TO "service_role";

GRANT ALL ON TABLE "public"."order_items" TO "anon";

GRANT ALL ON TABLE "public"."order_items" TO "authenticated";

GRANT ALL ON TABLE "public"."order_items" TO "service_role";

GRANT ALL ON TABLE "public"."orders" TO "anon";

GRANT ALL ON TABLE "public"."orders" TO "authenticated";

GRANT ALL ON TABLE "public"."orders" TO "service_role";

GRANT ALL ON TABLE "public"."payroll_entries" TO "anon";

GRANT ALL ON TABLE "public"."payroll_entries" TO "authenticated";

GRANT ALL ON TABLE "public"."payroll_entries" TO "service_role";

GRANT ALL ON TABLE "public"."payroll_periods" TO "anon";

GRANT ALL ON TABLE "public"."payroll_periods" TO "authenticated";

GRANT ALL ON TABLE "public"."payroll_periods" TO "service_role";

GRANT ALL ON TABLE "public"."reservations" TO "anon";

GRANT ALL ON TABLE "public"."reservations" TO "authenticated";

GRANT ALL ON TABLE "public"."reservations" TO "service_role";

GRANT ALL ON TABLE "public"."restaurants" TO "anon";

GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";

GRANT ALL ON TABLE "public"."restaurants" TO "service_role";

GRANT SELECT("rejection_messages") ON TABLE "public"."restaurants" TO "anon";

GRANT SELECT("rejection_messages") ON TABLE "public"."restaurants" TO "authenticated";

GRANT ALL ON TABLE "public"."roles" TO "anon";

GRANT ALL ON TABLE "public"."roles" TO "authenticated";

GRANT ALL ON TABLE "public"."roles" TO "service_role";

GRANT ALL ON TABLE "public"."staff" TO "anon";

GRANT ALL ON TABLE "public"."staff" TO "authenticated";

GRANT ALL ON TABLE "public"."staff" TO "service_role";

GRANT ALL ON TABLE "public"."staff_absences" TO "anon";

GRANT ALL ON TABLE "public"."staff_absences" TO "authenticated";

GRANT ALL ON TABLE "public"."staff_absences" TO "service_role";

GRANT ALL ON TABLE "public"."staff_history" TO "anon";

GRANT ALL ON TABLE "public"."staff_history" TO "authenticated";

GRANT ALL ON TABLE "public"."staff_history" TO "service_role";

GRANT ALL ON TABLE "public"."staff_invites" TO "anon";

GRANT ALL ON TABLE "public"."staff_invites" TO "authenticated";

GRANT ALL ON TABLE "public"."staff_invites" TO "service_role";

GRANT ALL ON TABLE "public"."tables" TO "anon";

GRANT ALL ON TABLE "public"."tables" TO "authenticated";

GRANT ALL ON TABLE "public"."tables" TO "service_role";

GRANT ALL ON TABLE "public"."user_profiles" TO "anon";

GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";

GRANT ALL ON TABLE "public"."waiter_requests" TO "anon";

GRANT ALL ON TABLE "public"."waiter_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."waiter_requests" TO "service_role";

GRANT ALL ON TABLE "public"."work_schedules" TO "anon";

GRANT ALL ON TABLE "public"."work_schedules" TO "authenticated";

GRANT ALL ON TABLE "public"."work_schedules" TO "service_role";
