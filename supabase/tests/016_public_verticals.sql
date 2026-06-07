-- ============================================================================
-- 2b · FAZA 4c — restaurants.active_verticals je javno čitljivo (guest routing)
-- ----------------------------------------------------------------------------
-- Guest sajt (anon) mora pročitati vertikale da bi hotel-only objekat
-- preusmjerio na /:slug/hotel. restaurants ima javnu SELECT politiku.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('owner_pub');
-- Hotel-only objekat (auto-create tenant fires).
INSERT INTO restaurants (id, user_id, name, slug, active_verticals)
VALUES ('ffffffff-6666-6666-6666-666666666666', tests.get_supabase_uid('owner_pub'), 'Samo Hotel', 'samo-hotel', '{hotel}');

-- Anon (gost) mora moći pročitati vertikale.
SELECT tests.clear_authentication();

SELECT is(
  (SELECT array_to_string(active_verticals, ',') FROM restaurants WHERE slug = 'samo-hotel'),
  'hotel',
  'Anon čita restaurants.active_verticals (javno) — hotel-only objekat');

SELECT ok(
  NOT ('restaurant' = ANY (SELECT unnest(active_verticals) FROM restaurants WHERE slug = 'samo-hotel')),
  'Hotel-only objekat nema restaurant vertikalu');

SELECT * FROM finish();
ROLLBACK;
