-- ============================================================================
-- DB test: razbijanje računa (create_split_invoices) + storno (create_storno_invoice).
-- Pokriva: source items helper, split na 2 računa, zbir = original, blokada
-- dvostrukog fakturisanja, korektivni račun (negativni iznosi + corrective_for),
-- idempotencija storna, zabrana storna nad stornom. BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('ss_owner');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('cccccccc-0000-0000-0000-000000000001', tests.get_supabase_uid('ss_owner'), 'Split Test', 'split-test', 'EUR');

INSERT INTO menu_items (id, restaurant_id, name, price, vat_rate_key) VALUES
  ('cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001', 'Burger', 12.10, 'STANDARD'),
  ('cccccccc-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-000000000001', 'Voda',    2.42, 'STANDARD');

-- O1 = za split (Burger + Voda; bruto 14.52)
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-000000000001', '1', 'closed', 14.52);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001', 'Burger', 12.10, 1),
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-000000000001', 'Voda',    2.42, 1);

-- O2 = za test blokade (već fakturisan jednim računom)
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('cccccccc-0000-0000-0000-0000000000b2', 'cccccccc-0000-0000-0000-000000000001', '2', 'closed', 12.10);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('cccccccc-0000-0000-0000-0000000000b2', 'cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000001', 'Burger', 12.10, 1);

SELECT tests.authenticate_as('ss_owner');

-- ── Test 1: get_invoice_source_items vrati 2 stavke ─────────────────────────
SELECT is(
  jsonb_array_length(get_invoice_source_items('cccccccc-0000-0000-0000-000000000001', 'order', 'cccccccc-0000-0000-0000-0000000000b1')),
  2, 'get_invoice_source_items vrati 2 stavke narudžbe');

-- ── Test 2: split na 2 računa ───────────────────────────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM create_split_invoices(
       'cccccccc-0000-0000-0000-000000000001', 'order', 'cccccccc-0000-0000-0000-0000000000b1',
       '[[{"name":"Burger","quantity":1,"unit_price_cents":1210,"vat_rate_key":"STANDARD"}],
         [{"name":"Voda","quantity":1,"unit_price_cents":242,"vat_rate_key":"STANDARD"}]]'::jsonb) $$,
  ARRAY[2], 'create_split_invoices kreira 2 računa');

-- ── Test 3: zbir split računa = original (1210 + 242 = 1452) ─────────────────
SELECT results_eq(
  $$ SELECT SUM(total_cents)::int FROM invoices
     WHERE source_id='cccccccc-0000-0000-0000-0000000000b1' AND corrective_for IS NULL $$,
  ARRAY[1452], 'Zbir split računa jednak originalnom iznosu');

-- ── Test 4: dvostruko fakturisanje blokirano ────────────────────────────────
SELECT create_invoice_from_order('cccccccc-0000-0000-0000-0000000000b2');
SELECT throws_ok(
  $$ SELECT create_split_invoices('cccccccc-0000-0000-0000-000000000001', 'order', 'cccccccc-0000-0000-0000-0000000000b2',
       '[[{"name":"Burger","quantity":1,"unit_price_cents":605,"vat_rate_key":"STANDARD"}],
         [{"name":"Burger","quantity":1,"unit_price_cents":605,"vat_rate_key":"STANDARD"}]]'::jsonb) $$,
  '22023', NULL, 'Split blokiran ako je izvor već fakturisan');

-- ── Test 5: storno = korektivni račun (negativni iznos + corrective_for) ─────
SELECT is(
  (SELECT total_cents FROM create_storno_invoice(
     (SELECT id FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000b1' AND total_cents=1210), 'Greška')),
  -1210, 'Storno ima negativan ukupan iznos (ogledalo originala)');

-- ── Test 6: storno idempotentan (drugi poziv ne pravi novi) ─────────────────
SELECT create_storno_invoice((SELECT id FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000b1' AND total_cents=1210));
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoices WHERE corrective_for=
       (SELECT id FROM invoices WHERE source_id='cccccccc-0000-0000-0000-0000000000b1' AND total_cents=1210) $$,
  ARRAY[1], 'Storno idempotentan: tačno 1 korektivni račun');

-- ── Test 7: storno nad stornom zabranjen ────────────────────────────────────
SELECT throws_ok(
  $$ SELECT create_storno_invoice((SELECT id FROM invoices WHERE corrective_for IS NOT NULL LIMIT 1)) $$,
  '22023', NULL, 'Storno korektivnog računa nije dozvoljen');

SELECT * FROM finish();
ROLLBACK;
