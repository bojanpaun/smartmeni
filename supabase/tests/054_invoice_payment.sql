-- ============================================================================
-- Naplata računa — mark_invoice_paid + get_order_invoices (Faza 1)
-- ----------------------------------------------------------------------------
-- staff označava/skida naplatu svog tenanta (ne tuđeg); pregled po stolu vraća
-- samo AKTIVNE order-račune (bez storniranih/korektivnih). BEGIN…ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('pay_owner_a');
SELECT tests.create_supabase_user('pay_owner_b');
SELECT tests.create_supabase_user('pay_staff_a');
SELECT tests.create_supabase_user('pay_outsider');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5555-5555-5555-555555555555', tests.get_supabase_uid('pay_owner_a'), 'PAY A', 'pay-a'),
  ('bbbbbbbb-5555-5555-5555-555555555555', tests.get_supabase_uid('pay_owner_b'), 'PAY B', 'pay-b');

INSERT INTO staff (id, restaurant_id, user_id, email, is_active) VALUES
  ('5ada0000-5555-5555-5555-555555555555', 'aaaaaaaa-5555-5555-5555-555555555555',
   tests.get_supabase_uid('pay_staff_a'), 'pay_staff@a.test', true);

INSERT INTO orders (id, restaurant_id, table_number, status) VALUES
  ('a0a00000-5555-5555-5555-555555555555', 'aaaaaaaa-5555-5555-5555-555555555555', '5', 'served'),
  ('b0b00000-5555-5555-5555-555555555555', 'bbbbbbbb-5555-5555-5555-555555555555', '9', 'served');

-- Računi: A1 aktivan/unpaid; A2 storniran (original) + A3 korektivni; B1 u tenantu B
INSERT INTO invoices (id, restaurant_id, source_type, source_id, idempotency_key,
                      invoice_ordinal, invoice_number, total_cents, total_base_cents, total_vat_cents) VALUES
  ('a1100000-5555-5555-5555-555555555555','aaaaaaaa-5555-5555-5555-555555555555','order','a0a00000-5555-5555-5555-555555555555','A1', 1,'1/DEFAULT/2026', 1500, 1240, 260),
  ('a2200000-5555-5555-5555-555555555555','aaaaaaaa-5555-5555-5555-555555555555','order','a0a00000-5555-5555-5555-555555555555','A2', 2,'2/DEFAULT/2026', 1000,  830, 170),
  ('b1100000-5555-5555-5555-555555555555','bbbbbbbb-5555-5555-5555-555555555555','order','b0b00000-5555-5555-5555-555555555555','B1', 1,'1/DEFAULT/2026',  900,  745, 155);
-- A3 = korektivni za A2 (A2 postaje storniran)
INSERT INTO invoices (id, restaurant_id, source_type, source_id, idempotency_key,
                      invoice_ordinal, invoice_number, total_cents, total_base_cents, total_vat_cents, corrective_for) VALUES
  ('a3300000-5555-5555-5555-555555555555','aaaaaaaa-5555-5555-5555-555555555555','order','a0a00000-5555-5555-5555-555555555555','A3', 3,'3/DEFAULT/2026', -1000, -830, -170,
   'a2200000-5555-5555-5555-555555555555');

SELECT tests.rls_enabled('public', 'invoices');

SELECT tests.authenticate_as('pay_staff_a');

-- (1) pregled po stolu vraća SAMO aktivni A1 (ne A2 storniran, ne A3 korektivni)
SELECT results_eq(
  $$ SELECT count(*)::int, max(table_number) FROM get_order_invoices('aaaaaaaa-5555-5555-5555-555555555555') $$,
  $$ VALUES (1, '5') $$,
  'pregled: samo aktivan A1 (sto 5), bez storno/korektivnih');

-- (2) staff označi plaćeno
SELECT results_eq(
  $$ SELECT payment_status FROM mark_invoice_paid('a1100000-5555-5555-5555-555555555555','card', true) $$,
  ARRAY['paid'],
  'staff označi račun plaćenim');

-- (3) atribucija naplate (paid_at + paid_by_staff_id)
SELECT results_eq(
  $$ SELECT (paid_at IS NOT NULL), paid_by_staff_id::text FROM invoices WHERE id='a1100000-5555-5555-5555-555555555555' $$,
  $$ VALUES (true, '5ada0000-5555-5555-5555-555555555555') $$,
  'naplata: paid_at postavljen + paid_by_staff_id = staff');

-- (4) vraćanje na neplaćeno
SELECT results_eq(
  $$ SELECT payment_status, (paid_at IS NULL) FROM mark_invoice_paid('a1100000-5555-5555-5555-555555555555', NULL, false) $$,
  $$ VALUES ('unpaid', true) $$,
  'staff vrati na neplaćeno (paid_at očišćen)');

-- (5) outsider (ni staff ni vlasnik) → not_authorized
SELECT tests.authenticate_as('pay_outsider');
SELECT throws_ok(
  $$ SELECT mark_invoice_paid('a1100000-5555-5555-5555-555555555555','cash', true) $$,
  'P0001', 'not_authorized', 'outsider ne može označiti naplatu');

-- (6) staff tenanta A NE može označiti račun tenanta B
SELECT tests.authenticate_as('pay_staff_a');
SELECT throws_ok(
  $$ SELECT mark_invoice_paid('b1100000-5555-5555-5555-555555555555','cash', true) $$,
  'P0001', 'not_authorized', 'staff A ne može označiti naplatu tenanta B');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
