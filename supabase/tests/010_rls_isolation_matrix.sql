-- ============================================================================
-- Sloj 1 — RLS IZOLACIONA MATRICA, svih 23 tenant tabela (mreža za 2b)
-- ----------------------------------------------------------------------------
-- Tenant A ne smije VIDJETI ni MIJENJATI podatke tenanta B. Referentni
-- before/after za migraciju na tenants/properties (Opcija 2b).
--
-- Dva sloja:
--   • DELETE-izolacija (SVIH 23) — A `DELETE ... WHERE restaurant_id=B` ne smije
--     ukloniti nijedan B-ov red. Mjeri se broj PRIJE vs POSLIJE (otporno na
--     auto-trigere koji prave dodatne redove, npr. room_availability, auto-guest).
--     Univerzalno (i za javno-čitljive tabele) — glavni štit od cross-tenant izmjene.
--   • SELECT-izolacija (potvrđeno PRIVATNE) — A vidi 0 redova tenanta B.
--
-- Javno-čitljive po dizajnu (categories, menu_items vidljive, orders, order_items
-- — guest meni/tracking) NEMAJU SELECT-izolaciju; štiti ih DELETE-izolacija.
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

-- Po jedan red tenanta B (room_availability NE seedujemo — trigger ga pravi pri
-- kreiranju room_type-a; ručni insert bi pao na unique (room_type_id, date)).
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
INSERT INTO hotel_reservations (restaurant_id, check_in_date, check_out_date, guest_name)
  VALUES ('bbbbbbbb-2222-2222-2222-222222222222', '2026-07-01', '2026-07-03', 'Gost B');
INSERT INTO folios             (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO booking_payments   (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO housekeeping_tasks (restaurant_id)              VALUES ('bbbbbbbb-2222-2222-2222-222222222222');
INSERT INTO maintenance_requests (restaurant_id, description) VALUES ('bbbbbbbb-2222-2222-2222-222222222222', 'Kvar B');

-- Snimi broj B-redova PRIJE pokušaja brisanja (kao postgres — vidi sve).
CREATE TEMP TABLE before_counts (tbl text PRIMARY KEY, n int);
INSERT INTO before_counts VALUES
  ('categories',         (SELECT count(*)::int FROM categories         WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('menu_items',         (SELECT count(*)::int FROM menu_items         WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('orders',             (SELECT count(*)::int FROM orders             WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('order_items',        (SELECT count(*)::int FROM order_items        WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('guests',             (SELECT count(*)::int FROM guests             WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('staff',              (SELECT count(*)::int FROM staff              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('roles',              (SELECT count(*)::int FROM roles              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('subscriptions',      (SELECT count(*)::int FROM subscriptions      WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('waiter_requests',    (SELECT count(*)::int FROM waiter_requests    WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('staff_invites',      (SELECT count(*)::int FROM staff_invites      WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('staff_absences',     (SELECT count(*)::int FROM staff_absences     WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('staff_history',      (SELECT count(*)::int FROM staff_history      WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('guest_visits',       (SELECT count(*)::int FROM guest_visits       WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('room_types',         (SELECT count(*)::int FROM room_types         WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('rooms',              (SELECT count(*)::int FROM rooms              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('rate_plans',         (SELECT count(*)::int FROM rate_plans         WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('seasonal_rates',     (SELECT count(*)::int FROM seasonal_rates     WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('room_availability',  (SELECT count(*)::int FROM room_availability  WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('hotel_reservations', (SELECT count(*)::int FROM hotel_reservations WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('folios',             (SELECT count(*)::int FROM folios             WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('booking_payments',   (SELECT count(*)::int FROM booking_payments   WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('housekeeping_tasks', (SELECT count(*)::int FROM housekeeping_tasks WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222')),
  ('maintenance_requests',(SELECT count(*)::int FROM maintenance_requests WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'));

-- before_counts mora biti čitljiv i kad se prebacimo na service_role (verifikacija).
GRANT SELECT ON before_counts TO service_role;

-- ── Ulogovan kao vlasnik A ──────────────────────────────────────────────────
SELECT tests.authenticate_as('owner_a');

-- (1) SELECT-izolacija — potvrđeno privatne tabele: A vidi 0 redova tenanta B.
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
DELETE FROM categories          WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM menu_items          WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM orders              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM order_items         WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM guests              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff               WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM roles               WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM subscriptions       WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM waiter_requests     WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_invites       WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_absences      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM staff_history       WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM guest_visits        WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM room_types          WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM rooms               WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM rate_plans          WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM seasonal_rates      WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM room_availability   WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM hotel_reservations  WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM folios              WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM booking_payments    WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM housekeeping_tasks  WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';
DELETE FROM maintenance_requests WHERE restaurant_id = 'bbbbbbbb-2222-2222-2222-222222222222';

-- ── Provjera kao service_role — broj B-redova nepromijenjen (DELETE bez efekta) ─
SELECT tests.authenticate_as_service_role();
SELECT is((SELECT count(*)::int FROM categories          WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='categories'),         'DELETE bez efekta: categories');
SELECT is((SELECT count(*)::int FROM menu_items          WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='menu_items'),         'DELETE bez efekta: menu_items');
SELECT is((SELECT count(*)::int FROM orders              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='orders'),             'DELETE bez efekta: orders');
SELECT is((SELECT count(*)::int FROM order_items         WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='order_items'),        'DELETE bez efekta: order_items');
SELECT is((SELECT count(*)::int FROM guests              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='guests'),             'DELETE bez efekta: guests');
SELECT is((SELECT count(*)::int FROM staff               WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='staff'),              'DELETE bez efekta: staff');
SELECT is((SELECT count(*)::int FROM roles               WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='roles'),              'DELETE bez efekta: roles');
SELECT is((SELECT count(*)::int FROM subscriptions       WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='subscriptions'),       'DELETE bez efekta: subscriptions');
SELECT is((SELECT count(*)::int FROM waiter_requests     WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='waiter_requests'),     'DELETE bez efekta: waiter_requests');
SELECT is((SELECT count(*)::int FROM staff_invites       WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='staff_invites'),       'DELETE bez efekta: staff_invites');
SELECT is((SELECT count(*)::int FROM staff_absences      WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='staff_absences'),      'DELETE bez efekta: staff_absences');
SELECT is((SELECT count(*)::int FROM staff_history       WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='staff_history'),       'DELETE bez efekta: staff_history');
SELECT is((SELECT count(*)::int FROM guest_visits        WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='guest_visits'),        'DELETE bez efekta: guest_visits');
SELECT is((SELECT count(*)::int FROM room_types          WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='room_types'),          'DELETE bez efekta: room_types');
SELECT is((SELECT count(*)::int FROM rooms               WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='rooms'),               'DELETE bez efekta: rooms');
SELECT is((SELECT count(*)::int FROM rate_plans          WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='rate_plans'),          'DELETE bez efekta: rate_plans');
SELECT is((SELECT count(*)::int FROM seasonal_rates      WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='seasonal_rates'),      'DELETE bez efekta: seasonal_rates');
SELECT is((SELECT count(*)::int FROM room_availability   WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='room_availability'),   'DELETE bez efekta: room_availability');
SELECT is((SELECT count(*)::int FROM hotel_reservations  WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='hotel_reservations'),  'DELETE bez efekta: hotel_reservations');
SELECT is((SELECT count(*)::int FROM folios              WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='folios'),              'DELETE bez efekta: folios');
SELECT is((SELECT count(*)::int FROM booking_payments    WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='booking_payments'),    'DELETE bez efekta: booking_payments');
SELECT is((SELECT count(*)::int FROM housekeeping_tasks  WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='housekeeping_tasks'),  'DELETE bez efekta: housekeeping_tasks');
SELECT is((SELECT count(*)::int FROM maintenance_requests WHERE restaurant_id='bbbbbbbb-2222-2222-2222-222222222222'), (SELECT n FROM before_counts WHERE tbl='maintenance_requests'),'DELETE bez efekta: maintenance_requests');

SELECT * FROM finish();
ROLLBACK;
