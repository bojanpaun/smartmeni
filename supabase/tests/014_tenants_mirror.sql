-- ============================================================================
-- 2b · FAZA 2 — mirror trigger: UPDATE account polja na restaurants → tenants
-- ----------------------------------------------------------------------------
-- Postojeći pisci (SuperAdminPanel, edge webhookovi) pišu account polja u
-- restaurants; AFTER UPDATE trigger mora to ogledati u tenants (izvor čitanja).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('owner_m');
-- INSERT restorana auto-kreira tenant (BEFORE INSERT trigger, 20260607000007).
INSERT INTO restaurants (id, user_id, name, slug, plan)
VALUES ('dddddddd-4444-4444-4444-444444444444', tests.get_supabase_uid('owner_m'), 'Mirror R', 'mirror-r', 'starter');

-- Pisac mijenja account polja na restaurants → mirror trigger ažurira tenants.
UPDATE restaurants
   SET plan = 'restaurant', is_complimentary = true
 WHERE id = 'dddddddd-4444-4444-4444-444444444444';

SELECT is(
  (SELECT plan FROM tenants WHERE id = 'dddddddd-4444-4444-4444-444444444444'),
  'restaurant',
  'Mirror: tenants.plan prati restaurants.plan nakon UPDATE');

SELECT is(
  (SELECT is_complimentary FROM tenants WHERE id = 'dddddddd-4444-4444-4444-444444444444'),
  true,
  'Mirror: tenants.is_complimentary prati restaurants nakon UPDATE');

SELECT * FROM finish();
ROLLBACK;
