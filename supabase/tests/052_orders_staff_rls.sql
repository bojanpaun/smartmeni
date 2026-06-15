-- ============================================================================
-- Faza WO — staff-scoped UPDATE RLS na orders + order_items (Migracija B)
-- ----------------------------------------------------------------------------
-- Aktivni STAFF (ne vlasnik) svog tenanta MOŽE da ažurira narudžbe/stavke svog
-- tenanta, ali NE i tuđeg. Šablon: 001/029. BEGIN…ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('ord_owner_a');
SELECT tests.create_supabase_user('ord_owner_b');
SELECT tests.create_supabase_user('ord_staff_a');  -- zaposleni tenanta A (NIJE vlasnik)

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', tests.get_supabase_uid('ord_owner_a'), 'ORD A', 'ord-a'),
  ('bbbbbbbb-7777-7777-7777-777777777777', tests.get_supabase_uid('ord_owner_b'), 'ORD B', 'ord-b');

-- Staff zapis: zaposleni tenanta A vezan na svoj auth nalog, aktivan
INSERT INTO staff (id, restaurant_id, user_id, email, is_active) VALUES
  ('5ada0000-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777',
   tests.get_supabase_uid('ord_staff_a'), 'staff_a@ord.test', true);

-- Narudžbe + stavke po jedna u svakom tenantu
INSERT INTO orders (id, restaurant_id, table_number, status) VALUES
  ('a0a00000-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777', '5', 'received'),
  ('b0b00000-7777-7777-7777-777777777777', 'bbbbbbbb-7777-7777-7777-777777777777', '5', 'received');

INSERT INTO order_items (id, restaurant_id, order_id, name, price, quantity) VALUES
  ('a1100000-7777-7777-7777-777777777777', 'aaaaaaaa-7777-7777-7777-777777777777',
   'a0a00000-7777-7777-7777-777777777777', 'Stavka A', 3.50, 1),
  ('b1100000-7777-7777-7777-777777777777', 'bbbbbbbb-7777-7777-7777-777777777777',
   'b0b00000-7777-7777-7777-777777777777', 'Stavka B', 4.00, 1);

-- (0) RLS uključen
SELECT tests.rls_enabled('public', 'orders');
SELECT tests.rls_enabled('public', 'order_items');

SELECT tests.authenticate_as('ord_staff_a');

-- (1) Staff A MOŽE ažurirati narudžbu svog tenanta
UPDATE orders SET note = 'waiter ok' WHERE id = 'a0a00000-7777-7777-7777-777777777777';
SELECT results_eq(
  $$ SELECT note FROM orders WHERE id = 'a0a00000-7777-7777-7777-777777777777' $$,
  ARRAY['waiter ok'],
  'Staff A MOZE azurirati narudzbu svog tenanta');

-- (2) Staff A NE MOŽE ažurirati narudžbu tenanta B (0 redova, bez greške)
UPDATE orders SET note = 'hack' WHERE id = 'b0b00000-7777-7777-7777-777777777777';
SELECT is_empty(
  $$ SELECT 1 FROM orders WHERE id = 'b0b00000-7777-7777-7777-777777777777' AND note = 'hack' $$,
  'Staff A NE moze azurirati narudzbu tenanta B');

-- (3) Staff A MOŽE ažurirati stavku svog tenanta
UPDATE order_items SET name = 'Stavka A2' WHERE id = 'a1100000-7777-7777-7777-777777777777';
SELECT results_eq(
  $$ SELECT name FROM order_items WHERE id = 'a1100000-7777-7777-7777-777777777777' $$,
  ARRAY['Stavka A2'],
  'Staff A MOZE azurirati stavku svog tenanta');

-- (4) Staff A NE MOŽE ažurirati stavku tenanta B
UPDATE order_items SET name = 'HACK' WHERE id = 'b1100000-7777-7777-7777-777777777777';
SELECT is_empty(
  $$ SELECT 1 FROM order_items WHERE id = 'b1100000-7777-7777-7777-777777777777' AND name = 'HACK' $$,
  'Staff A NE moze azurirati stavku tenanta B');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
