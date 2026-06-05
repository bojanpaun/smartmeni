-- ============================================================================
-- Trajni data guard: restaurant_id NOT NULL na svim tenant tabelama
-- ----------------------------------------------------------------------------
-- Pravilo §1 (multi-tenancy): svaki tenant red MORA nositi restaurant_id.
-- Ove 23 tabele su imale nullable restaurant_id → tih orphan/tenant-leak je bio
-- moguć (kao bug u create_spa_folio_item, vidi 20260605000001). Pretvaramo tihi
-- NULL u tvrdu grešku na nivou baze.
--
-- BEZBJEDNOST (provjereno prije pisanja):
--   • Svih 34 insert puteva (src/ + edge funkcije + SECURITY DEFINER funkcije)
--     postavljaju restaurant_id — nijedan upis neće puknuti od NOT NULL.
--   • Za razliku od folio_items, ove tabele se NE backfiluju (restaurant_id JE
--     tenant veza). Preduslov: prod nema postojeći restaurant_id IS NULL red.
--     Ako ga ima, ovaj ALTER namjerno pada i poništava migraciju (fail-safe) —
--     taj red treba ručno istražiti/obrisati prije ponovnog pokušaja.
-- ============================================================================

ALTER TABLE "public"."booking_payments"     ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."categories"           ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."folios"               ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."guest_visits"         ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."guests"               ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."hotel_reservations"   ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."housekeeping_tasks"   ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."maintenance_requests" ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."menu_items"           ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."order_items"          ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."orders"               ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."rate_plans"           ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."roles"                ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."room_availability"    ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."room_types"           ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."rooms"                ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."seasonal_rates"       ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."staff"                ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."staff_absences"       ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."staff_history"        ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."staff_invites"        ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."subscriptions"        ALTER COLUMN "restaurant_id" SET NOT NULL;
ALTER TABLE "public"."waiter_requests"      ALTER COLUMN "restaurant_id" SET NOT NULL;
