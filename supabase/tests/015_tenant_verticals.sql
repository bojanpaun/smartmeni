-- ============================================================================
-- 2b — restaurants.active_verticals: default + guard
-- ----------------------------------------------------------------------------
-- Izvor vertikala je restaurants.active_verticals (javno čitljiv). Novi restoran
-- bez navedenih vertikala dobija default '{restaurant}'; nijedan nema praznu listu.
-- (Raniji tenants.active_verticals uklonjen u 20260607000011.)
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('owner_v');
-- Bez active_verticals u insertu → kolona uzima default '{restaurant}'.
INSERT INTO restaurants (id, user_id, name, slug)
VALUES ('eeeeeeee-5555-5555-5555-555555555555', tests.get_supabase_uid('owner_v'), 'Vert R', 'vert-r');

SELECT ok(
  'restaurant' = ANY (SELECT unnest(active_verticals) FROM restaurants WHERE id = 'eeeeeeee-5555-5555-5555-555555555555'),
  'Novi restoran ima default vertikalu restaurant');

SELECT is(
  (SELECT count(*)::int FROM restaurants WHERE active_verticals IS NULL OR cardinality(active_verticals) = 0),
  0,
  'Nijedan restoran nema praznu listu active_verticals');

SELECT * FROM finish();
ROLLBACK;
