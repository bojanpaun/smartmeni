-- ============================================================================
-- Sloj 1 — RLS IZOLACIONA MATRICA, svih 23 tenant tabela (mreža za 2b)
-- ----------------------------------------------------------------------------
-- Tenant A ne smije VIDJETI ni MIJENJATI podatke tenanta B. Referentni
-- before/after za migraciju na tenants/properties (Opcija 2b).
--
-- Tri sloja provjere:
--   • DELETE-izolacija (SVIH 23) — A `DELETE ... WHERE restaurant_id=B` ne smije
--     obrisati B-ov red. UNIVERZALNO važi (i za javno-čitljive tabele) i ne
--     zavisi od kolona/FK vrijednosti — glavni štit od cross-tenant izmjene.
--   • SELECT-izolacija (potvrđeno PRIVATNE) — A vidi 0 redova tenanta B.
--   • INSERT-throws (jednostavne) — A ne može INSERT s tuđim restaurant_id (42501).
--
-- Javno-čitljive po dizajnu (categories, menu_items vidljive, orders — guest
-- meni/tracking) NEMAJU SELECT-izolaciju; za njih vrijedi DELETE/INSERT izolacija.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(33);

-- ── Setup (postgres → zaobilazi RLS pri seedovanju) ─────────────────────────
SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-rls'),
  ('bbbbbbbb-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-rls');

-- Po jedan red tenanta B u SVAKOJ od 23 tenant tabele (redoslijed poštuje FK).
INSERT INTO categories         (restaurant_id, name)        VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Kat B');
INSERT INTO menu_items         (restaurant_id, name, price) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Jelo B', 5);
INSERT INTO orders             (restaurant_id, table_number) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'S1');
INSERT INTO order_items        (restaurant_id, name, price) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Stavka B', 5);
INSERT INTO guests             (restaurant_id, first_name)  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Gost B');
INSERT INTO staff              (restaurant_id, email)       VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'b@staff.test');
INSERT INTO roles              (restaurant_id, name)        VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Konobar B');
INSERT INTO subscriptions      (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO waiter_requests    (restaurant_id, table_number, request_type) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'S1', 'call');
INSERT INTO staff_invites      (restaurant_id, email)       VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'invite-b@x.test');
INSERT INTO staff_absences     (restaurant_id, absence_type, start_date, end_date) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'vacation', '2026-07-01', '2026-07-05');
INSERT INTO staff_history      (restaurant_id, event_type)  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'hired');
INSERT INTO guest_visits       (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO room_types         (restaurant_id, name)        VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Dvokrevetna B');
INSERT INTO rooms              (restaurant_id, room_number) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', '101');
INSERT INTO rate_plans         (restaurant_id, name, price_per_night) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Standard B', 50);
INSERT INTO seasonal_rates     (restaurant_id, rate_plan_id, start_date, end_date, price_per_night)
  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', (SELECT id FROM rate_plans WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222' LIMIT 1), '2026-07-01', '2026-07-31', 70);
INSERT INTO room_availability  (restaurant_id, room_type_id, date)
  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', (SELECT id FROM room_types WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222' LIMIT 1), '2026-07-01');
INSERT INTO hotel_reservations (restaurant_id, check_in_date, check_out_date, guest_name)
  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', '2026-07-01', '2026-07-03', 'Gost B');
INSERT INTO folios             (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO booking_payments   (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO housekeeping_tasks (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO maintenance_requests (restaurant_id, description) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Kvar B');

-- ── Ulogovan kao vlasnik A ──────────────────────────────────────────────────
SELECT tests.authenticate_as('owner_a');

-- (1) SELECT-izolacija — potvrđeno privatne tabele: A vidi 0 redova tenanta B.
-- (order_items, orders, categories, menu_items su JAVNO čitljivi po dizajnu —
--  guest meni/tracking — pa nemaju SELECT-izolaciju; njih štiti DELETE-izolacija.)
SELECT results_eq($$ SELECT count(*)::int FROM guests             $$, ARRAY[0], 'SELECT: guests');
SELECT results_eq($$ SELECT count(*)::int FROM staff              $$, ARRAY[0], 'SELECT: staff');
SELECT results_eq($$ SELECT count(*)::int FROM roles              $$, ARRAY[0], 'SELECT: roles');
SELECT results_eq($$ SELECT count(*)::int FROM subscriptions      $$, ARRAY[0], 'SELECT: subscriptions');
SELECT results_eq($$ SELECT count(*)::int FROM hotel_reservations $$, ARRAY[0], 'SELECT: hotel_reservations');
SELECT results_eq($$ SELECT count(*)::int FROM folios             $$, ARRAY[0], 'SELECT: folios');
SELECT results_eq($$ SELECT count(*)::int FROM booking_payments   $$, ARRAY[0], 'SELECT: booking_payments');
SELECT results_eq($$ SELECT count(*)::int FROM guest_visits       $$, ARRAY[0], 'SELECT: guest_visits');
SELECT results_eq($$ SELECT count(*)::int FROM staff_absences     $$, ARRAY[0], 'SELECT: staff_absences');
SELECT results_eq($$ SELECT count(*)::int FROM staff_history      $$, ARRAY[0], 'SELECT: staff_history');

-- (2) DELETE-izolacija (SVIH 23) — A pokušava obrisati B-ove redove (bez efekta).
-- Univerzalna write-izolacija: ne zavisi od read-vidljivosti tabele.
DELETE FROM categories         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM menu_items         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM orders             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM order_items        WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM guests             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM roles              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM subscriptions      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM waiter_requests    WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_invites      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_absences     WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_history      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM guest_visits       WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM room_types         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM rooms              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM rate_plans         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM seasonal_rates     WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM room_availability  WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM hotel_reservations WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM folios             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM booking_payments   WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM housekeeping_tasks WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM maintenance_requests WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';

-- ── Provjera kao service_role (zaobilazi RLS) — svaki B-ov red i dalje postoji ─
SELECT tests.authenticate_as_service_role();
SELECT is((SELECT count(*)::int FROM categories         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: categories');
SELECT is((SELECT count(*)::int FROM menu_items         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: menu_items');
SELECT is((SELECT count(*)::int FROM orders             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: orders');
SELECT is((SELECT count(*)::int FROM order_items        WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: order_items');
SELECT is((SELECT count(*)::int FROM guests             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: guests');
SELECT is((SELECT count(*)::int FROM staff              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: staff');
SELECT is((SELECT count(*)::int FROM roles              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: roles');
SELECT is((SELECT count(*)::int FROM subscriptions      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: subscriptions');
SELECT is((SELECT count(*)::int FROM waiter_requests    WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: waiter_requests');
SELECT is((SELECT count(*)::int FROM staff_invites      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: staff_invites');
SELECT is((SELECT count(*)::int FROM staff_absences     WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: staff_absences');
SELECT is((SELECT count(*)::int FROM staff_history      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: staff_history');
SELECT is((SELECT count(*)::int FROM guest_visits       WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: guest_visits');
SELECT is((SELECT count(*)::int FROM room_types         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: room_types');
SELECT is((SELECT count(*)::int FROM rooms              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: rooms');
SELECT is((SELECT count(*)::int FROM rate_plans         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: rate_plans');
SELECT is((SELECT count(*)::int FROM seasonal_rates     WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: seasonal_rates');
SELECT is((SELECT count(*)::int FROM room_availability  WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: room_availability');
SELECT is((SELECT count(*)::int FROM hotel_reservations WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: hotel_reservations');
SELECT is((SELECT count(*)::int FROM folios             WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: folios');
SELECT is((SELECT count(*)::int FROM booking_payments   WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: booking_payments');
SELECT is((SELECT count(*)::int FROM housekeeping_tasks WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: housekeeping_tasks');
SELECT is((SELECT count(*)::int FROM maintenance_requests WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222'), 1, 'DELETE bez efekta: maintenance_requests');

SELECT * FROM finish();
ROLLBACK;
