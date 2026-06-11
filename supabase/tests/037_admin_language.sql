-- ============================================================================
-- admin_language — per-tenant jezik admin panela (multilingvalno, Faza 0)
-- ----------------------------------------------------------------------------
-- Provjerava: (1) autocreate trigger kopira admin_language u tenants pri INSERT-u
-- restorana (default 'me'), (2) mirror trigger prati izmjenu admin_language.
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

SELECT tests.create_supabase_user('owner_lang');

-- INSERT restorana auto-kreira tenant (BEFORE INSERT trigger) — admin_language default 'me'.
INSERT INTO restaurants (id, user_id, name, slug, plan)
VALUES ('dddddddd-7777-7777-7777-777777777777', tests.get_supabase_uid('owner_lang'), 'Lang R', 'lang-r', 'starter');

SELECT is(
  (SELECT admin_language FROM restaurants WHERE id = 'dddddddd-7777-7777-7777-777777777777'),
  'me',
  'admin_language default je "me" na restaurants');

SELECT is(
  (SELECT admin_language FROM tenants WHERE id = 'dddddddd-7777-7777-7777-777777777777'),
  'me',
  'Autocreate: tenants.admin_language kopiran iz restaurants (default "me")');

-- Pisac mijenja admin_language → mirror trigger ažurira tenants.
UPDATE restaurants SET admin_language = 'sq'
 WHERE id = 'dddddddd-7777-7777-7777-777777777777';

SELECT is(
  (SELECT admin_language FROM tenants WHERE id = 'dddddddd-7777-7777-7777-777777777777'),
  'sq',
  'Mirror: tenants.admin_language prati restaurants nakon UPDATE');

SELECT * FROM finish();
ROLLBACK;
