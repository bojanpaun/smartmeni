-- ============================================================================
-- Faza WO — waiter_submit_order RPC
-- ----------------------------------------------------------------------------
-- happy (nova): status/source/routing/total/stavke · append (Δ total, served→preparing,
-- bar routing) · odbijanje ne-staff (not_active_staff). BEGIN…ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(8);

SELECT tests.create_supabase_user('ws_owner_a');
SELECT tests.create_supabase_user('ws_staff_a');    -- aktivan konobar tenanta A
SELECT tests.create_supabase_user('ws_outsider');   -- nema staff zapis u A

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-6666-6666-6666-666666666666', tests.get_supabase_uid('ws_owner_a'), 'WS A', 'ws-a');

INSERT INTO staff (id, restaurant_id, user_id, email, is_active) VALUES
  ('5ada0000-6666-6666-6666-666666666666', 'aaaaaaaa-6666-6666-6666-666666666666',
   tests.get_supabase_uid('ws_staff_a'), 'ws_staff@a.test', true);

-- Kategorije: hrana (kuhinja) + piće (bar)
INSERT INTO categories (id, restaurant_id, name, is_bar) VALUES
  ('cafa0000-6666-6666-6666-666666666666', 'aaaaaaaa-6666-6666-6666-666666666666', 'Hrana',  false),
  ('cad00000-6666-6666-6666-666666666666', 'aaaaaaaa-6666-6666-6666-666666666666', 'Pića',   true);

SELECT tests.authenticate_as('ws_staff_a');

-- ── HAPPY (nova narudžba) — poziv RPC-a kroz prvu provjeru ──────────────────
-- Burger 5.00×2 (hrana) + Pivo 3.00×1 (bar)
SELECT results_eq(
  $$ SELECT status, source FROM waiter_submit_order(
       'aaaaaaaa-6666-6666-6666-666666666666', '7',
       '[{"name":"Burger","price":5.00,"quantity":2,"category_id":"cafa0000-6666-6666-6666-666666666666"},
         {"name":"Pivo","price":3.00,"quantity":1,"category_id":"cad00000-6666-6666-6666-666666666666"}]'::jsonb,
       'auto') $$,
  $$ VALUES ('preparing'::text, 'waiter'::text) $$,
  'nova: status=preparing, source=waiter');

-- (2) routing po is_bar: i kuhinja i bar = preparing
SELECT results_eq(
  $$ SELECT kitchen_status, bar_status FROM orders
     WHERE restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666' $$,
  $$ VALUES ('preparing'::text, 'preparing'::text) $$,
  'routing: kitchen i bar = preparing');

-- (3) total = 5*2 + 3*1 = 13.00
SELECT results_eq(
  $$ SELECT total::text FROM orders WHERE restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666' $$,
  ARRAY['13.00'],
  'total = 13.00');

-- (4) 2 stavke ubačene
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666' $$,
  ARRAY[2],
  'nova: 2 stavke ubačene');

-- ── APPEND (dopuna) — simuliraj 'served' pa donaruči piće ───────────────────
UPDATE orders SET status = 'served'
 WHERE restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666';

SELECT results_eq(
  $$ SELECT status FROM waiter_submit_order(
       'aaaaaaaa-6666-6666-6666-666666666666', '7',
       '[{"name":"Vino","price":3.00,"quantity":1,"category_id":"cad00000-6666-6666-6666-666666666666"}]'::jsonb,
       'auto') $$,
  ARRAY['preparing'],
  'append: served → preparing reset');

-- (6) total = 13 + 3 = 16.00
SELECT results_eq(
  $$ SELECT total::text FROM orders WHERE restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666' $$,
  ARRAY['16.00'],
  'append: total = 16.00');

-- (7) sada 3 stavke
SELECT results_eq(
  $$ SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.restaurant_id = 'aaaaaaaa-6666-6666-6666-666666666666' $$,
  ARRAY[3],
  'append: 3 stavke ukupno');

-- ── ODBIJANJE: ne-staff korisnik ───────────────────────────────────────────
SELECT tests.authenticate_as('ws_outsider');
SELECT throws_ok(
  $$ SELECT waiter_submit_order(
       'aaaaaaaa-6666-6666-6666-666666666666', '8',
       '[{"name":"X","price":1.00,"quantity":1,"category_id":"cafa0000-6666-6666-6666-666666666666"}]'::jsonb,
       'auto') $$,
  'P0001', 'not_active_staff',
  'ne-staff korisnik: not_active_staff');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
