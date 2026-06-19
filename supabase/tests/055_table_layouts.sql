-- ============================================================================
-- DB test: table_layouts — partial unique (jedan aktivan), RLS izolacija drafta,
-- set_active_table_layout (auth + prebacivanje), duplicate_table_layout. BEGIN…ROLLBACK.
-- UUID prostor dddddddd-7117-… (provjereno: ne preklapa se sa seed.sql ni drugim testovima).
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('lay_a');
SELECT tests.create_supabase_user('lay_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-7117-7117-7117-71177117a001', tests.get_supabase_uid('lay_a'), 'Layout A', 'layout-a'),
  ('dddddddd-7117-7117-7117-71177117b001', tests.get_supabase_uid('lay_b'), 'Layout B', 'layout-b');

-- ── A kreira aktivan + draft layout, sa jednim stolom u aktivnom ─────────────
SELECT tests.authenticate_as('lay_a');
INSERT INTO table_layouts (id, restaurant_id, name, is_active) VALUES
  ('dddddddd-7117-7117-7117-71177117a101', 'dddddddd-7117-7117-7117-71177117a001', 'Standardni', true),
  ('dddddddd-7117-7117-7117-71177117a102', 'dddddddd-7117-7117-7117-71177117a001', 'Svadba', false);
INSERT INTO tables (restaurant_id, layout_id, number, seats) VALUES
  ('dddddddd-7117-7117-7117-71177117a001', 'dddddddd-7117-7117-7117-71177117a101', 1, 4);

-- (1) partial unique index: drugi aktivan layout za isti restoran → 23505
SELECT throws_ok(
  $$ INSERT INTO table_layouts (id, restaurant_id, name, is_active)
     VALUES ('dddddddd-7117-7117-7117-71177117a103', 'dddddddd-7117-7117-7117-71177117a001', 'Drugi aktivan', true) $$,
  '23505', NULL, 'Partial unique index odbija drugi aktivan layout po restoranu');

-- (2) RLS SELECT: tenant B ne vidi A-jev DRAFT layout (aktivan je namjerno javan)
SELECT tests.authenticate_as('lay_b');
SELECT is_empty(
  $$ SELECT 1 FROM table_layouts WHERE id = 'dddddddd-7117-7117-7117-71177117a102' $$,
  'Tenant B ne vidi draft layout tenanta A');

-- (3) RLS WITH CHECK: B ne može upisati layout u tuđi restoran → 42501
SELECT throws_ok(
  $$ INSERT INTO table_layouts (restaurant_id, name) VALUES ('dddddddd-7117-7117-7117-71177117a001', 'Hack') $$,
  '42501', NULL, 'Tenant B ne može upisati layout u tuđi restoran');

-- (4) set_active_table_layout odbija neovlašćenog korisnika → 42501
SELECT throws_ok(
  $$ SELECT set_active_table_layout('dddddddd-7117-7117-7117-71177117a001', 'dddddddd-7117-7117-7117-71177117a102') $$,
  '42501', NULL, 'set_active_table_layout odbija neovlašćenog korisnika');

-- (5) set_active_table_layout korektno prebacuje aktivan flag (kao vlasnik A)
SELECT tests.authenticate_as('lay_a');
SELECT set_active_table_layout('dddddddd-7117-7117-7117-71177117a001', 'dddddddd-7117-7117-7117-71177117a102');
SELECT is(
  (SELECT array_agg(id ORDER BY name) FROM table_layouts
     WHERE restaurant_id = 'dddddddd-7117-7117-7117-71177117a001' AND is_active),
  ARRAY['dddddddd-7117-7117-7117-71177117a102']::uuid[],
  'set_active prebacuje aktivan na izabrani (tačno jedan aktivan)');

-- (6)+(7) duplicate_table_layout → draft pod novim imenom + klonira stolove
CREATE TEMP TABLE _dup AS
  SELECT duplicate_table_layout('dddddddd-7117-7117-7117-71177117a101', 'Kopija') AS id;
SELECT ok(
  (SELECT name = 'Kopija' AND is_active = false
     FROM table_layouts WHERE id = (SELECT id FROM _dup)),
  'duplicate_table_layout kreira draft pod novim imenom');
SELECT is(
  (SELECT count(*)::int FROM tables WHERE layout_id = (SELECT id FROM _dup)),
  (SELECT count(*)::int FROM tables WHERE layout_id = 'dddddddd-7117-7117-7117-71177117a101'),
  'duplicate_table_layout klonira sve stolove izvornog layouta');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
