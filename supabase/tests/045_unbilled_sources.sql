-- ============================================================================
-- DB test: get_unbilled_sources — narudžba bez računa se pojavi, a nakon izdavanja
-- računa nestane (trajni pristup izdavanju). Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('ub_owner');
INSERT INTO restaurants (id, user_id, name, slug, currency) VALUES
  ('ddddffff-0000-0000-0000-000000000001', tests.get_supabase_uid('ub_owner'), 'Unbilled Test', 'ub-test', 'EUR');

INSERT INTO menu_items (id, restaurant_id, name, price, vat_rate_key) VALUES
  ('ddddffff-0000-0000-0000-0000000000a1', 'ddddffff-0000-0000-0000-000000000001', 'Kafa', 1.20, 'STANDARD');
INSERT INTO orders (id, restaurant_id, table_number, status, total) VALUES
  ('ddddffff-0000-0000-0000-0000000000b1', 'ddddffff-0000-0000-0000-000000000001', '3', 'served', 1.20);
INSERT INTO order_items (order_id, menu_item_id, restaurant_id, name, price, quantity) VALUES
  ('ddddffff-0000-0000-0000-0000000000b1', 'ddddffff-0000-0000-0000-0000000000a1',
   'ddddffff-0000-0000-0000-000000000001', 'Kafa', 1.20, 1);

SELECT tests.authenticate_as('ub_owner');

-- ── Test 1: servirana narudžba bez računa se pojavljuje ─────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM get_unbilled_sources('ddddffff-0000-0000-0000-000000000001')
     WHERE source_type='order' AND source_id='ddddffff-0000-0000-0000-0000000000b1' $$,
  ARRAY[1],
  'Servirana narudžba bez računa je u listi za izdavanje'
);

-- ── Test 2: nakon izdavanja računa, narudžba nestaje iz liste ───────────────
SELECT create_invoice_from_order('ddddffff-0000-0000-0000-0000000000b1');
SELECT results_eq(
  $$ SELECT count(*)::int FROM get_unbilled_sources('ddddffff-0000-0000-0000-000000000001')
     WHERE source_id='ddddffff-0000-0000-0000-0000000000b1' $$,
  ARRAY[0],
  'Nakon izdavanja računa narudžba više nije u listi za izdavanje'
);

-- ── Test 3: ne-vlasnik ne može dobiti listu (42501) ─────────────────────────
SELECT tests.create_supabase_user('ub_other');
SELECT tests.authenticate_as('ub_other');
SELECT throws_ok(
  $$ SELECT * FROM get_unbilled_sources('ddddffff-0000-0000-0000-000000000001') $$,
  '42501', NULL,
  'Ne-vlasnik ne može dobiti listu nedovršenih izvora'
);

SELECT * FROM finish();
ROLLBACK;
