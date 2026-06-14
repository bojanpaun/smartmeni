-- ============================================================================
-- DB test: FISK-2c-readeri — create_invoice_from_order (po-izvor assembly).
-- Pokriva: source linkage, PDV iz menu_items.vat_rate_key, prenos stavki,
-- idempotencija po izvoru. (spa/folio readeri dijele identičan obrazac → jezgro
-- pokriva 041.) Pokretanje: supabase test db  (BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('rd_owner');

INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('55555555-5555-5555-5555-555555555555', tests.get_supabase_uid('rd_owner'), 'Reader Test', 'reader-test', 'EUR');

-- Artikl klasifikovan STANDARD (21%).
INSERT INTO menu_items (id, restaurant_id, name, price, vat_rate_key) VALUES
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Burger', 12.10, 'STANDARD');

-- Narudžba + stavka (2× = bruto 24.20).
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '5', 'closed', 24.20);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666',
   '55555555-5555-5555-5555-555555555555', 'Burger', 12.10, 2);

SELECT tests.authenticate_as('rd_owner');

-- ── Test 1: reader kreira račun ─────────────────────────────────────────────
SELECT lives_ok(
  $$ SELECT create_invoice_from_order('77777777-7777-7777-7777-777777777777') $$,
  'create_invoice_from_order kreira račun iz narudžbe'
);

-- ── Test 2: source linkage ──────────────────────────────────────────────────
SELECT results_eq(
  $$ SELECT source_type, source_id FROM invoices
     WHERE idempotency_key='order:77777777-7777-7777-7777-777777777777' $$,
  $$ VALUES ('order', '77777777-7777-7777-7777-777777777777'::uuid) $$,
  'Račun vezan za narudžbu (source_type/source_id)'
);

-- ── Test 3: PDV iz menu_items.vat_rate_key (24.20 @21% → 20.00 + 4.20) ───────
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices
     WHERE source_id='77777777-7777-7777-7777-777777777777' $$,
  $$ VALUES (2420, 2000, 420) $$,
  'PDV 21% iz vat_rate_key: 24.20 → osnovica 20.00 + PDV 4.20'
);

-- ── Test 4: stavka prenesena na račun ───────────────────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.source_id='77777777-7777-7777-7777-777777777777' $$,
  ARRAY[1],
  'Stavka narudžbe prenesena na račun'
);

-- ── Test 5: idempotencija po izvoru — ponovni poziv ne pravi novi ───────────
SELECT create_invoice_from_order('77777777-7777-7777-7777-777777777777');
SELECT results_eq(
  $$ SELECT count(*)::int FROM invoices WHERE restaurant_id='55555555-5555-5555-5555-555555555555' $$,
  ARRAY[1],
  'Idempotentno po izvoru: i dalje tačno 1 račun'
);

-- ── Test 6: nasljeđivanje stope iz KATEGORIJE (jelo bez stope) ──────────────
-- Kategorija HOSP (15%), jelo bez vat_rate_key → efektivna stopa = kategorijina.
INSERT INTO categories (id, restaurant_id, name, vat_rate_key) VALUES
  ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', 'Hrana', 'HOSP');
INSERT INTO menu_items (id, restaurant_id, category_id, name, price) VALUES
  ('99999999-9999-9999-9999-999999999999', '55555555-5555-5555-5555-555555555555',
   '88888888-8888-8888-8888-888888888888', 'Supa', 11.50);  -- bez vat_rate_key
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('aaaa0000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '6', 'closed', 11.50);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('aaaa0000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999',
   '55555555-5555-5555-5555-555555555555', 'Supa', 11.50, 1);

SELECT create_invoice_from_order('aaaa0000-0000-0000-0000-000000000001');
SELECT results_eq(
  $$ SELECT total_cents, total_base_cents, total_vat_cents FROM invoices
     WHERE source_id='aaaa0000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1150, 1000, 150) $$,
  'Jelo bez stope nasljeđuje HOSP 15% iz kategorije: 11.50 → 10.00 + 1.50'
);

SELECT * FROM finish();
ROLLBACK;
