-- ============================================================================
-- DB test: events + event_guests — RLS izolacija (owner A/B), kaskada
-- event→event_guests, SET NULL pri brisanju stola, guests CRM red preživi brisanje
-- eventa. BEGIN…ROLLBACK. UUID prostor dddddddd-7337-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('ev_a');
SELECT tests.create_supabase_user('ev_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-7337-7337-7337-73377337a001', tests.get_supabase_uid('ev_a'), 'Ev A', 'ev-a'),
  ('dddddddd-7337-7337-7337-73377337b001', tests.get_supabase_uid('ev_b'), 'Ev B', 'ev-b');

INSERT INTO table_layouts (id, restaurant_id, name, is_active) VALUES
  ('dddddddd-7337-7337-7337-73377337a101', 'dddddddd-7337-7337-7337-73377337a001', 'Svadba', true);
INSERT INTO tables (id, restaurant_id, layout_id, number, seats) VALUES
  ('dddddddd-7337-7337-7337-73377337a201', 'dddddddd-7337-7337-7337-73377337a001', 'dddddddd-7337-7337-7337-73377337a101', 1, 8);
INSERT INTO guests (id, restaurant_id, first_name) VALUES
  ('dddddddd-7337-7337-7337-73377337a301', 'dddddddd-7337-7337-7337-73377337a001', 'Marko');
INSERT INTO events (id, restaurant_id, name, date, layout_id, status) VALUES
  ('dddddddd-7337-7337-7337-73377337a401', 'dddddddd-7337-7337-7337-73377337a001', 'Svadba M&A', '2026-08-01',
   'dddddddd-7337-7337-7337-73377337a101', 'confirmed');
INSERT INTO event_guests (id, event_id, restaurant_id, table_id, guest_id, first_name, party_size) VALUES
  ('dddddddd-7337-7337-7337-73377337a501', 'dddddddd-7337-7337-7337-73377337a401',
   'dddddddd-7337-7337-7337-73377337a001', 'dddddddd-7337-7337-7337-73377337a201',
   'dddddddd-7337-7337-7337-73377337a301', 'Marko', 2);

-- (1) RLS: vlasnik B ne vidi A-jev event
SELECT tests.authenticate_as('ev_b');
SELECT is_empty(
  $$ SELECT 1 FROM events WHERE id = 'dddddddd-7337-7337-7337-73377337a401' $$,
  'Vlasnik B ne vidi event tenanta A');

-- (2) RLS WITH CHECK: B ne može upisati event u A → 42501
SELECT throws_ok(
  $$ INSERT INTO events (restaurant_id, name, date) VALUES ('dddddddd-7337-7337-7337-73377337a001', 'Hack', '2026-08-02') $$,
  '42501', NULL, 'Vlasnik B ne može upisati event u tuđi restoran');

-- (3) RLS: B ne vidi A-jeve goste eventa
SELECT is_empty(
  $$ SELECT 1 FROM event_guests WHERE event_id = 'dddddddd-7337-7337-7337-73377337a401' $$,
  'Vlasnik B ne vidi goste eventa tenanta A');

-- (4) SET NULL: brisanje stola NULL-uje event_guests.table_id (gost ostaje)
SELECT tests.authenticate_as('ev_a');
DELETE FROM tables WHERE id = 'dddddddd-7337-7337-7337-73377337a201';
SELECT is(
  (SELECT table_id FROM event_guests WHERE id = 'dddddddd-7337-7337-7337-73377337a501'),
  NULL, 'Brisanje stola NULL-uje event_guests.table_id (gost ostaje rasjeden→nerasjeden)');

-- (5) CASCADE: brisanje eventa briše njegove goste
DELETE FROM events WHERE id = 'dddddddd-7337-7337-7337-73377337a401';
SELECT is(
  (SELECT count(*)::int FROM event_guests WHERE event_id = 'dddddddd-7337-7337-7337-73377337a401'),
  0, 'Brisanje eventa kaskadno briše event_guests');

-- (6) guests CRM red preživljava brisanje eventa
SELECT is(
  (SELECT count(*)::int FROM guests WHERE id = 'dddddddd-7337-7337-7337-73377337a301'),
  1, 'CRM gost (guests) preživljava brisanje eventa');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
