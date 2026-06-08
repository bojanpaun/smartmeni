-- ============================================================================
-- staff_announcements — cross-tenant izolacija (Faza 3 sigurnosni fix)
-- ----------------------------------------------------------------------------
-- Prije: staff_read USING(true) → svi čitaju sve. Poslije: samo osoblje svog
-- restorana. BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('sa_owner_a');
SELECT tests.create_supabase_user('sa_owner_b');
SELECT tests.create_supabase_user('sa_staff_a');
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-d000-d000-d000-d000d000d000', tests.get_supabase_uid('sa_owner_a'), 'SA A', 'sa-a'),
  ('bbbbbbbb-d000-d000-d000-d000d000d000', tests.get_supabase_uid('sa_owner_b'), 'SA B', 'sa-b');

-- Aktivno osoblje restorana A
INSERT INTO staff (restaurant_id, user_id, email, is_active)
  VALUES ('aaaaaaaa-d000-d000-d000-d000d000d000', tests.get_supabase_uid('sa_staff_a'), 'staff-a@test.me', true);

-- Obavijesti u oba restorana
INSERT INTO staff_announcements (id, restaurant_id, title) VALUES
  ('cccccccc-d000-d000-d000-d000d000d000', 'aaaaaaaa-d000-d000-d000-d000d000d000', 'Obavijest A'),
  ('dddddddd-d000-d000-d000-d000d000d000', 'bbbbbbbb-d000-d000-d000-d000d000d000', 'Obavijest B');

-- (1) Vlasnik A vidi svoju obavijest
SELECT tests.authenticate_as('sa_owner_a');
SELECT results_eq(
  $$ SELECT count(*)::int FROM staff_announcements WHERE id = 'cccccccc-d000-d000-d000-d000d000d000' $$,
  ARRAY[1],
  'Vlasnik A vidi svoju obavijest osoblja');

-- (2) Vlasnik A NE vidi obavijest tenanta B (curenje zatvoreno)
SELECT is_empty(
  $$ SELECT 1 FROM staff_announcements WHERE id = 'dddddddd-d000-d000-d000-d000d000d000' $$,
  'Vlasnik A NE vidi obavijest osoblja tenanta B');

-- (3) Osoblje A i dalje čita obavijesti svog restorana (funkcija radi)
SELECT tests.authenticate_as('sa_staff_a');
SELECT results_eq(
  $$ SELECT count(*)::int FROM staff_announcements WHERE id = 'cccccccc-d000-d000-d000-d000d000d000' $$,
  ARRAY[1],
  'Osoblje A čita obavijesti svog restorana');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
