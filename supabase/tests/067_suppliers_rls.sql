-- ============================================================================
-- DB test: suppliers RLS izolacija (Inventory Pro v2 — Faza 1)
-- ----------------------------------------------------------------------------
-- Owner A vidi samo svoje dobavljače, ne tuđe; ne može pisati za tenant B.
-- Pokretanje: supabase test db   (BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Tenant A', 'tenant-a-sup'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Tenant B', 'tenant-b-sup');

INSERT INTO suppliers (restaurant_id, name, category) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dobavljač A', 'fnb'),
  ('22222222-2222-2222-2222-222222222222', 'Dobavljač B', 'spa');

-- RLS uključen
SELECT tests.rls_enabled('public', 'suppliers');

SELECT tests.authenticate_as('owner_a');

SELECT results_eq(
  'SELECT count(*)::int FROM suppliers',
  ARRAY[1],
  'Vlasnik A vidi tačno svog 1 dobavljača'
);

SELECT is_empty(
  $$ SELECT 1 FROM suppliers WHERE name = 'Dobavljač B' $$,
  'Vlasnik A NE vidi dobavljača tenanta B'
);

-- WITH CHECK: A ne može ubaciti dobavljača za tenant B
SELECT throws_ok(
  $$ INSERT INTO suppliers (restaurant_id, name) VALUES ('22222222-2222-2222-2222-222222222222', 'Ubačen iz A') $$,
  '42501', NULL,
  'Vlasnik A NE može kreirati dobavljača za tenant B'
);

-- A može kreirati svog dobavljača i vezati ga na svoju stavku zalihe
SELECT lives_ok(
  $$ WITH s AS (
       INSERT INTO suppliers (restaurant_id, name, category, rating)
       VALUES ('11111111-1111-1111-1111-111111111111', 'Novi A', 'fnb', 4) RETURNING id
     )
     INSERT INTO inventory_items (restaurant_id, name, supplier_id)
     SELECT '11111111-1111-1111-1111-111111111111', 'Brašno', id FROM s $$,
  'Vlasnik A kreira dobavljača + veže ga na stavku zalihe'
);

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
