-- ============================================================================
-- DB test: staff_notification_clears — RLS izolacija (per-user dismiss).
-- BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('nc_a');
SELECT tests.create_supabase_user('nc_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('cccccccc-0000-0000-0000-000000000a01', tests.get_supabase_uid('nc_a'), 'Notif Clear', 'notif-clear');

-- ── A: postavi svoj clear ───────────────────────────────────────────────────
SELECT tests.authenticate_as('nc_a');
INSERT INTO staff_notification_clears (user_id, restaurant_id) VALUES
  (tests.get_supabase_uid('nc_a'), 'cccccccc-0000-0000-0000-000000000a01');
SELECT is(
  (SELECT count(*)::int FROM staff_notification_clears WHERE user_id = tests.get_supabase_uid('nc_a')),
  1, 'A vidi svoj clear red');

-- ── B NE vidi A-jev red (RLS) ───────────────────────────────────────────────
SELECT tests.authenticate_as('nc_b');
SELECT is_empty(
  $$ SELECT 1 FROM staff_notification_clears $$,
  'B ne vidi tuđe clear redove');

-- ── B NE može upisati red sa A-jevim user_id (RLS WITH CHECK) ───────────────
SELECT throws_ok(
  format($$ INSERT INTO staff_notification_clears (user_id, restaurant_id) VALUES (%L, 'cccccccc-0000-0000-0000-000000000a01') $$, tests.get_supabase_uid('nc_a')),
  '42501', NULL, 'B ne može upisati clear u ime drugog korisnika');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
