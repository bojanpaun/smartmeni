-- ============================================================================
-- DB test: partner_ads — RLS izolacija + placement CHECK.
-- Aktivne reklame su NAMJERNO javne (gost na meniju ih čita) → testiramo da:
--   • neaktivna reklama NIJE vidljiva drugom tenantu,
--   • aktivna reklama JESTE javna,
--   • pisanje je izolovano (WITH CHECK),
--   • placement CHECK odbija nevalidnu vrijednost,
--   • brisanje restorana kaskadno briše reklame.
-- BEGIN…ROLLBACK. UUID prostor dddddddd-ad00-… (provjereno slobodan).
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('ad_a');
SELECT tests.create_supabase_user('ad_b');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-ad00-ad00-ad00-ad00ad00a001', tests.get_supabase_uid('ad_a'), 'Ad A', 'ad-a'),
  ('dddddddd-ad00-ad00-ad00-ad00ad00b001', tests.get_supabase_uid('ad_b'), 'Ad B', 'ad-b');

INSERT INTO partner_ads (id, restaurant_id, title, placement, is_active) VALUES
  ('dddddddd-ad00-ad00-ad00-ad00ad00a101', 'dddddddd-ad00-ad00-ad00-ad00ad00a001', 'Coca-Cola', 'top', true),
  ('dddddddd-ad00-ad00-ad00-ad00ad00a102', 'dddddddd-ad00-ad00-ad00-ad00ad00a001', 'Skriveni', 'top', false);

-- (1) RLS: vlasnik B ne vidi A-jevu NEAKTIVNU reklamu
SELECT tests.authenticate_as('ad_b');
SELECT is_empty(
  $$ SELECT 1 FROM partner_ads WHERE id = 'dddddddd-ad00-ad00-ad00-ad00ad00a102' $$,
  'Vlasnik B ne vidi neaktivnu reklamu tenanta A');

-- (2) AKTIVNA reklama je javna (gost-scenario) — B je vidi
SELECT isnt_empty(
  $$ SELECT 1 FROM partner_ads WHERE id = 'dddddddd-ad00-ad00-ad00-ad00ad00a101' $$,
  'Aktivna reklama je javno čitljiva (banner za goste)');

-- (3) RLS WITH CHECK: B ne može upisati reklamu u A → 42501
SELECT throws_ok(
  $$ INSERT INTO partner_ads (restaurant_id, title) VALUES ('dddddddd-ad00-ad00-ad00-ad00ad00a001', 'Hack') $$,
  '42501', NULL, 'Vlasnik B ne može upisati reklamu u tuđi restoran');

-- (4) CHECK: nevalidan placement se odbija
SELECT tests.authenticate_as('ad_a');
SELECT throws_ok(
  $$ INSERT INTO partner_ads (restaurant_id, title, placement) VALUES ('dddddddd-ad00-ad00-ad00-ad00ad00a001', 'Loš', 'sidebar') $$,
  '23514', NULL, 'placement van (top/middle/bottom) se odbija (CHECK)');

-- (5) CASCADE: brisanje restorana briše reklame
DELETE FROM restaurants WHERE id = 'dddddddd-ad00-ad00-ad00-ad00ad00a001';
SELECT is(
  (SELECT count(*)::int FROM partner_ads WHERE restaurant_id = 'dddddddd-ad00-ad00-ad00-ad00ad00a001'),
  0, 'Brisanje restorana kaskadno briše reklame');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
