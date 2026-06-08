-- ============================================================================
-- Tenant approval — RLS (javno samo approved) + trigger (forsira pending)
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('ap_a');
SELECT tests.create_supabase_user('ap_b');

-- Seed kao service_role (auth.uid() IS NULL → trigger NE forsira pending; uzima se
-- prosljeđena/ default vrijednost). A=approved, B=pending.
INSERT INTO restaurants (id, user_id, name, slug, approval_status) VALUES
  ('aaaaaaaa-ab00-ab00-ab00-ab00ab00ab00', tests.get_supabase_uid('ap_a'), 'AP A', 'ap-a', 'approved'),
  ('bbbbbbbb-ab00-ab00-ab00-ab00ab00ab00', tests.get_supabase_uid('ap_b'), 'AP B', 'ap-b', 'pending');

-- ── Anon (javnost) ──────────────────────────────────────────────────────────
SELECT tests.clear_authentication();

-- (1) Anon vidi approved restoran A
SELECT results_eq(
  $$ SELECT count(*)::int FROM restaurants WHERE id = 'aaaaaaaa-ab00-ab00-ab00-ab00ab00ab00' $$,
  ARRAY[1],
  'Anon vidi approved restoran');

-- (2) Anon NE vidi pending restoran B
SELECT is_empty(
  $$ SELECT 1 FROM restaurants WHERE id = 'bbbbbbbb-ab00-ab00-ab00-ab00ab00ab00' $$,
  'Anon NE vidi pending restoran (skriven dok nije odobren)');

-- ── Vlasnik pending tenanta vidi svoj ───────────────────────────────────────
SELECT tests.authenticate_as('ap_b');
SELECT results_eq(
  $$ SELECT count(*)::int FROM restaurants WHERE id = 'bbbbbbbb-ab00-ab00-ab00-ab00ab00ab00' $$,
  ARRAY[1],
  'Vlasnik vidi svoj pending restoran (svoja FOR ALL politika)');

-- ── Drugi vlasnik NE vidi tuđi pending ──────────────────────────────────────
SELECT tests.authenticate_as('ap_a');
SELECT is_empty(
  $$ SELECT 1 FROM restaurants WHERE id = 'bbbbbbbb-ab00-ab00-ab00-ab00ab00ab00' $$,
  'Vlasnik A NE vidi pending restoran vlasnika B');

-- ── Trigger: autentifikovani ne-superadmin insert sa 'approved' → forsiran pending ──
SELECT tests.authenticate_as('ap_a');
INSERT INTO restaurants (user_id, name, slug, approval_status)
  VALUES (tests.get_supabase_uid('ap_a'), 'AP A2', 'ap-a2', 'approved');

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT approval_status FROM restaurants WHERE slug = 'ap-a2'),
  'pending',
  'Trigger forsira pending na insertu autentifikovanog ne-superadmina (uprkos approved)');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
