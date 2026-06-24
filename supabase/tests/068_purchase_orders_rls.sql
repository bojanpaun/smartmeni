-- ============================================================================
-- DB test: narudžbenice (Inventory Pro v2 — Faza 2)
-- ----------------------------------------------------------------------------
-- • RLS izolacija purchase_orders / purchase_order_items (owner A ≠ owner B)
-- • Numeracija po_number po tenantu (1,2…)
-- • receive_purchase_order(): primka → inventory_movements 'purchase' + stanje + status
-- Pokretanje: supabase test db   (BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(10);

SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-po'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-po');

-- Stavka zalihe tenanta A (početno stanje 5)
INSERT INTO inventory_items (id, restaurant_id, name, unit, quantity, min_quantity) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Brašno', 'kg', 5, 20);

-- Narudžbenice A (po_number se dodjeljuje triggerom → 1, pa 2) i jedna B
INSERT INTO purchase_orders (id, restaurant_id, status) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'sent');
INSERT INTO purchase_orders (id, restaurant_id, status) VALUES
  ('aaaaaaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'draft');
INSERT INTO purchase_orders (id, restaurant_id, status) VALUES
  ('bbbbbbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'draft');

-- Stavka na PO #1 (poručeno 10, primljeno 0)
INSERT INTO purchase_order_items (id, purchase_order_id, restaurant_id, item_id, item_name, unit, qty_ordered, qty_received) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Brašno', 'kg', 10, 0);

-- ── RLS uključen ──
SELECT tests.rls_enabled('public', 'purchase_orders');
SELECT tests.rls_enabled('public', 'purchase_order_items');

SELECT tests.authenticate_as('owner_a');

-- Vlasnik A vidi svoje 2 narudžbenice, ne tuđu
SELECT results_eq(
  'SELECT count(*)::int FROM purchase_orders',
  ARRAY[2],
  'Vlasnik A vidi tačno svoje 2 narudžbenice'
);

SELECT is_empty(
  $$ SELECT 1 FROM purchase_orders WHERE id = 'bbbbbbbb-1111-1111-1111-111111111111' $$,
  'Vlasnik A NE vidi narudžbenicu tenanta B'
);

-- WITH CHECK: A ne može kreirati PO za tenant B
SELECT throws_ok(
  $$ INSERT INTO purchase_orders (restaurant_id, status) VALUES ('22222222-2222-2222-2222-222222222222', 'draft') $$,
  '42501', NULL,
  'Vlasnik A NE može kreirati narudžbenicu za tenant B'
);

-- Numeracija po tenantu: prva = 1, druga = 2
SELECT results_eq(
  $$ SELECT po_number FROM purchase_orders
     WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' ORDER BY created_at $$,
  ARRAY[1, 2],
  'po_number se dodjeljuje rastuće po tenantu (1, 2)'
);

-- ── Primka: primi svih 10 kg ──
SELECT lives_ok(
  $$ SELECT receive_purchase_order(
       'aaaaaaaa-1111-1111-1111-111111111111',
       '[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","qty_received":10}]'::jsonb
     ) $$,
  'Primka narudžbenice prolazi'
);

-- Stanje zalihe poraslo 5 → 15
SELECT results_eq(
  $$ SELECT quantity FROM inventory_items WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ VALUES (15::numeric(10,3)) $$,
  'Primka povećava stanje zalihe za primljenu količinu (5 → 15)'
);

-- Kretanje zalihe tipa 'purchase' upisano
SELECT isnt_empty(
  $$ SELECT 1 FROM inventory_movements
     WHERE item_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       AND source = 'purchase' AND type = 'in' AND quantity = 10 $$,
  'Primka upisuje inventory_movements (source=purchase, in, 10)'
);

-- Status PO postaje 'received' (sve primljeno)
SELECT results_eq(
  $$ SELECT status FROM purchase_orders WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111' $$,
  $$ VALUES ('received'::text) $$,
  'Potpuna primka prebacuje status u received'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
