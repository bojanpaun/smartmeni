-- ============================================================================
-- 2b · "Dodaj biznis" — owner mijenja vlastite vertikale, tuđe ne može
-- ----------------------------------------------------------------------------
-- ControlPanel addVertical radi UPDATE restaurants.active_verticals. Mora raditi
-- za vlastiti restoran, a biti blokirano za tuđi (owner RLS).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('av_a');
SELECT tests.create_supabase_user('av_b');
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', tests.get_supabase_uid('av_a'), 'AV A', 'av-a'),
  ('bbbbbbbb-7777-7777-7777-777777777777', tests.get_supabase_uid('av_b'), 'AV B', 'av-b');

SELECT tests.authenticate_as('av_a');

-- A mijenja SVOJE vertikale (dodaje hotel).
UPDATE restaurants SET active_verticals = '{restaurant,hotel}'
 WHERE id = 'aaaaaaaa-7777-7777-7777-777777777777';
-- A pokušava promijeniti B-ove (bez efekta).
UPDATE restaurants SET active_verticals = '{hotel}'
 WHERE id = 'bbbbbbbb-7777-7777-7777-777777777777';

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT array_to_string(active_verticals, ',') FROM restaurants WHERE id = 'aaaaaaaa-7777-7777-7777-777777777777'),
  'restaurant,hotel',
  'Owner može dodati vertikalu na svoj restoran');
SELECT is(
  (SELECT array_to_string(active_verticals, ',') FROM restaurants WHERE id = 'bbbbbbbb-7777-7777-7777-777777777777'),
  'restaurant',
  'Owner NE može mijenjati vertikale tuđeg restorana');

SELECT * FROM finish();
ROLLBACK;
