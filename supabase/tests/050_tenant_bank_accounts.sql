-- ============================================================================
-- DB test: tenant_bank_accounts — RLS izolacija + mirror primarnog na
-- restaurants.iban + set_primary_bank_account. BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('ba_a');
SELECT tests.create_supabase_user('ba_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('cccccccc-0000-0000-0000-0000000000f1', tests.get_supabase_uid('ba_a'), 'Bank A', 'bank-a'),
  ('cccccccc-0000-0000-0000-0000000000f2', tests.get_supabase_uid('ba_b'), 'Bank B', 'bank-b');

-- ── A: prvi račun → auto-primary → mirror na restaurants.iban ───────────────
SELECT tests.authenticate_as('ba_a');
INSERT INTO tenant_bank_accounts (restaurant_id, iban, label) VALUES
  ('cccccccc-0000-0000-0000-0000000000f1', 'ME25IBAN0000000001', 'Glavni');
SELECT is(
  (SELECT iban FROM restaurants WHERE id='cccccccc-0000-0000-0000-0000000000f1'),
  'ME25IBAN0000000001', 'Prvi račun se mirror-uje na restaurants.iban');

-- ── B NE vidi A-jeve račune (RLS) ───────────────────────────────────────────
SELECT tests.authenticate_as('ba_b');
SELECT is_empty(
  $$ SELECT 1 FROM tenant_bank_accounts WHERE restaurant_id='cccccccc-0000-0000-0000-0000000000f1' $$,
  'Tenant B ne vidi bankovne račune tenanta A');

-- ── B NE može upisati račun u A (RLS WITH CHECK) ────────────────────────────
SELECT throws_ok(
  $$ INSERT INTO tenant_bank_accounts (restaurant_id, iban) VALUES ('cccccccc-0000-0000-0000-0000000000f1', 'HACK') $$,
  '42501', NULL, 'Tenant B ne može upisati račun u tuđi tenant');

-- ── A: drugi račun + set_primary → mirror se prebaci ────────────────────────
SELECT tests.authenticate_as('ba_a');
INSERT INTO tenant_bank_accounts (restaurant_id, iban, label) VALUES
  ('cccccccc-0000-0000-0000-0000000000f1', 'ME25IBAN0000000002', 'Devizni');
SELECT set_primary_bank_account((SELECT id FROM tenant_bank_accounts WHERE iban='ME25IBAN0000000002'));
SELECT is(
  (SELECT iban FROM restaurants WHERE id='cccccccc-0000-0000-0000-0000000000f1'),
  'ME25IBAN0000000002', 'set_primary prebacuje mirror na novi primarni IBAN');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
