-- ============================================================================
-- DB test: audit_log RLS + log_audit_event RPC
-- ----------------------------------------------------------------------------
-- • Tenant (vlasnik) vidi SAMO svoje redove, ne tuđe.
-- • Superadmin vidi sve.
-- • Direktan INSERT iz authenticated klijenta je zabranjen (nema INSERT politike).
-- • log_audit_event() stempluje actora iz auth.uid() i poštuje vlasništvo nad tenantom.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(8);

-- ── Setup (kao postgres — RLS zaobiđen pri seedu) ───────────────────────────
SELECT tests.create_supabase_user('sa');
SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-audit'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-audit');

INSERT INTO audit_log (restaurant_id, actor_id, actor_role, action) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'owner', 'seed.a'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'owner', 'seed.b');

-- ── Test 0: RLS uključen ────────────────────────────────────────────────────
SELECT tests.rls_enabled('public', 'audit_log');

-- ── Tenant A izolacija ──────────────────────────────────────────────────────
SELECT tests.authenticate_as('owner_a');

SELECT results_eq(
  'SELECT count(*)::int FROM audit_log',
  ARRAY[1],
  'Vlasnik A vidi tačno svoj 1 zapis (ne oba)'
);

SELECT is_empty(
  $$ SELECT 1 FROM audit_log WHERE action = 'seed.b' $$,
  'Vlasnik A NE vidi zapis tenanta B (čitanje izolovano)'
);

-- Direktan INSERT iz klijenta je zabranjen (nema INSERT politike za authenticated).
SELECT throws_ok(
  $$ INSERT INTO audit_log (restaurant_id, action)
     VALUES ('11111111-1111-1111-1111-111111111111', 'forged') $$,
  '42501',
  NULL,
  'Vlasnik A NE može direktno upisati u audit_log (RLS odbija)'
);

-- log_audit_event za VLASTITI tenant prolazi i stempluje ulogu 'owner'.
SELECT lives_ok(
  $$ SELECT public.log_audit_event('menu.updated', '11111111-1111-1111-1111-111111111111', 'menu_item', 'x1', 'Test') $$,
  'Vlasnik A može logovati događaj za svoj tenant'
);

SELECT results_eq(
  $$ SELECT actor_role FROM audit_log WHERE action = 'menu.updated' $$,
  $$ VALUES ('owner') $$,
  'log_audit_event stempluje actor_role = owner iz auth.uid()'
);

-- log_audit_event za TUĐI tenant baca grešku (P0001 'Nemate pravo na ovaj tenant').
SELECT throws_ok(
  $$ SELECT public.log_audit_event('menu.updated', '22222222-2222-2222-2222-222222222222') $$,
  'P0001',
  'Nemate pravo na ovaj tenant',
  'Vlasnik A NE može logovati događaj za tenant B'
);

-- ── Superadmin vidi sve ─────────────────────────────────────────────────────
SELECT tests.authenticate_as('sa');
SELECT results_eq(
  $$ SELECT count(*)::int FROM audit_log WHERE action LIKE 'seed.%' $$,
  ARRAY[2],
  'Superadmin vidi zapise svih tenanta'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
