-- ============================================================================
-- DB test: payment_transactions.source_type CHECK prima 'rental' (4. payment tačka)
-- i odbija nepoznat tip. BEGIN…ROLLBACK. UUID prostor dddddddd-aa30-….
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('pay_r');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-aa30-aa30-aa30-aa30aa30a001', tests.get_supabase_uid('pay_r'), 'Pay R', 'pay-r');

SELECT tests.authenticate_as('pay_r');

-- (1) source_type='rental' prolazi (CHECK proširen)
SELECT lives_ok(
  $$ INSERT INTO payment_transactions (restaurant_id, provider, provider_ref, idempotency_key, source_type, amount_minor)
     VALUES ('dddddddd-aa30-aa30-aa30-aa30aa30a001', 'monri', 'ref-1', 'rental:abc:deposit', 'rental', 5000) $$,
  'payment_transactions prihvata source_type = rental');

-- (2) nepoznat source_type → 23514 (check_violation)
SELECT throws_ok(
  $$ INSERT INTO payment_transactions (restaurant_id, provider, provider_ref, idempotency_key, source_type, amount_minor)
     VALUES ('dddddddd-aa30-aa30-aa30-aa30aa30a001', 'monri', 'ref-2', 'x:1', 'bogus', 100) $$,
  '23514', NULL, 'Nepoznat source_type je odbijen CHECK-om');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
