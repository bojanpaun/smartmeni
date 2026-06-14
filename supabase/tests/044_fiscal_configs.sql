-- ============================================================================
-- DB test: FISK-3 — tenant_fiscal_configs RLS izolacija + fiscal_credentials
-- BEZ SELECT (čak ni vlasnik ne čita sadržaj kredencijala). Šablon: payments.
-- Pokretanje: supabase test db   (BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('fc_a');
SELECT tests.create_supabase_user('fc_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('a1a1a1a1-0000-0000-0000-000000000001', tests.get_supabase_uid('fc_a'), 'Tenant A', 'fc-a'),
  ('b2b2b2b2-0000-0000-0000-000000000002', tests.get_supabase_uid('fc_b'), 'Tenant B', 'fc-b');

-- ── Test 1: vlasnik A kreira fiskalni config ────────────────────────────────
SELECT tests.authenticate_as('fc_a');
SELECT lives_ok(
  $$ INSERT INTO tenant_fiscal_configs (id, restaurant_id, provider, enu_code)
     VALUES ('c3c3c3c3-0000-0000-0000-000000000003', 'a1a1a1a1-0000-0000-0000-000000000001', 'stub', 'ENU-1') $$,
  'Vlasnik A kreira fiskalni config'
);

-- ── Test 2: kredencijali se upisuju ali se NE mogu čitati (bez SELECT) ───────
SELECT lives_ok(
  $$ INSERT INTO fiscal_credentials (config_id, restaurant_id, credentials)
     VALUES ('c3c3c3c3-0000-0000-0000-000000000003', 'a1a1a1a1-0000-0000-0000-000000000001', '{"key":"tajna"}'::jsonb) $$,
  'Vlasnik A upisuje kredencijale'
);
SELECT results_eq(
  $$ SELECT count(*)::int FROM fiscal_credentials WHERE restaurant_id='a1a1a1a1-0000-0000-0000-000000000001' $$,
  ARRAY[0],
  'Ni vlasnik ne čita kredencijale preko klijenta (nema SELECT politike)'
);

-- ── Test 3: tenant B ne vidi config tenanta A (RLS izolacija) ───────────────
SELECT tests.authenticate_as('fc_b');
SELECT results_eq(
  $$ SELECT count(*)::int FROM tenant_fiscal_configs WHERE restaurant_id='a1a1a1a1-0000-0000-0000-000000000001' $$,
  ARRAY[0],
  'Tenant B ne vidi fiskalni config tenanta A'
);

-- ── Test 4: B ne može upisati kredencijale za tuđi config (ownership) ───────
SELECT throws_ok(
  $$ SELECT save_fiscal_credentials('c3c3c3c3-0000-0000-0000-000000000003', '{"key":"hak"}'::jsonb) $$,
  '42501', NULL,
  'B ne može sačuvati kredencijale za config tenanta A'
);

SELECT * FROM finish();
ROLLBACK;
