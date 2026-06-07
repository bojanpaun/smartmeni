-- ============================================================================
-- 2b · FAZA 3 — testovi za tenants.active_verticals
-- ----------------------------------------------------------------------------
-- Novi tenant (preko auto-create pri unosu restorana) mora dobiti default
-- vertikalu 'restaurant'; nijedan tenant ne smije imati praznu listu vertikala.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('owner_v');
-- INSERT restorana → auto-create tenant (20260607000007); active_verticals = default.
INSERT INTO restaurants (id, user_id, name, slug)
VALUES ('eeeeeeee-5555-5555-5555-555555555555', tests.get_supabase_uid('owner_v'), 'Vert R', 'vert-r');

SELECT ok(
  'restaurant' = ANY (SELECT unnest(active_verticals) FROM tenants WHERE id = 'eeeeeeee-5555-5555-5555-555555555555'),
  'Novi tenant ima default vertikalu restaurant');

-- Nijedan tenant nema praznu listu vertikala (svaki bar jednu).
SELECT is(
  (SELECT count(*)::int FROM tenants WHERE active_verticals IS NULL OR cardinality(active_verticals) = 0),
  0,
  'Nijedan tenant nema praznu listu active_verticals');

SELECT * FROM finish();
ROLLBACK;
