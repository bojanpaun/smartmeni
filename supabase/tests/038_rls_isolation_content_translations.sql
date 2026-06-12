-- ============================================================================
-- RLS izolacija na content_translations (Faza 3 — AI prevod tenant-sadržaja)
-- ----------------------------------------------------------------------------
-- Prevodi su NAMJERNO javno čitljivi (gost u meniju bira jezik anonimno), pa se
-- ne testira read-izolacija nego WRITE-izolacija: tenant A ne smije pisati ni
-- mijenjati prevode tenanta B. Šablon: 029. BEGIN ... ROLLBACK.
-- Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('ct_a');
SELECT tests.create_supabase_user('ct_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', tests.get_supabase_uid('ct_a'), 'CT A', 'ct-a'),
  ('bbbbbbbb-7777-7777-7777-777777777777', tests.get_supabase_uid('ct_b'), 'CT B', 'ct-b');

-- Seed: po jedan prevod (en) u svakom tenantu
INSERT INTO content_translations (restaurant_id, entity_type, entity_id, field, lang, value) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', 'menu_item', 'a1a1a1a1-7777-7777-7777-777777777777', 'name', 'en', 'Cheese A'),
  ('bbbbbbbb-7777-7777-7777-777777777777', 'menu_item', 'b1b1b1b1-7777-7777-7777-777777777777', 'name', 'en', 'Cheese B');

-- (0) RLS uključen
SELECT tests.rls_enabled('public', 'content_translations');

SELECT tests.authenticate_as('ct_a');

-- (1) Prevodi su javni → A vidi OBA reda (read nije izolovan, namjerno)
SELECT results_eq(
  'SELECT count(*)::int FROM content_translations',
  ARRAY[2],
  'Prevodi su javno čitljivi — vlasnik A vidi i prevod tenanta B');

-- (2) A NE može INSERT u tenant B (WITH CHECK)
SELECT throws_ok(
  $$ INSERT INTO content_translations (restaurant_id, entity_type, entity_id, field, lang, value)
     VALUES ('bbbbbbbb-7777-7777-7777-777777777777', 'menu_item', 'b2b2b2b2-7777-7777-7777-777777777777', 'name', 'sr', 'Hak') $$,
  '42501',
  NULL,
  'Vlasnik A NE može pisati prevod u tenant B');

-- (3) A NE može UPDATE tuđeg prevoda (USING filter → 0 redova)
SELECT is_empty(
  $$ UPDATE content_translations SET value = 'HACKED'
     WHERE restaurant_id = 'bbbbbbbb-7777-7777-7777-777777777777' RETURNING 1 $$,
  'Vlasnik A UPDATE tuđeg prevoda ne mijenja nijedan red');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
