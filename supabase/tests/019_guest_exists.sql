-- ============================================================================
-- guest_exists() — detekcija duplikata gosta + restoran izolacija
-- ----------------------------------------------------------------------------
-- Vraća pending|exists|none; blacklist se gleda kao exists; gleda samo zadati
-- restoran (gost istog broja kod drugog restorana ne curi).
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(5);

-- Setup: dva restorana (tenant se auto-kreira triggerom na insert restaurants).
SELECT tests.create_supabase_user('ge_owner_a');
SELECT tests.create_supabase_user('ge_owner_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', tests.get_supabase_uid('ge_owner_a'), 'Rest A', 'ge-rest-a'),
  ('bbbbbbbb-7777-7777-7777-777777777777', tests.get_supabase_uid('ge_owner_b'), 'Rest B', 'ge-rest-b');

INSERT INTO public.guests (restaurant_id, first_name, phone, email, status) VALUES
  ('aaaaaaaa-7777-7777-7777-777777777777', 'Pend',  '111', NULL,        'pending'),
  ('aaaaaaaa-7777-7777-7777-777777777777', 'Reg',   NULL,  'a@x.com',   'regular'),
  ('aaaaaaaa-7777-7777-7777-777777777777', 'Black', '222', NULL,        'blacklist'),
  ('bbbbbbbb-7777-7777-7777-777777777777', 'BVip',  '111', NULL,        'vip');

-- (1) pending broj → 'pending'
SELECT is(
  public.guest_exists('aaaaaaaa-7777-7777-7777-777777777777', '111', NULL),
  'pending',
  'Postojeći pending gost (telefon) → pending');

-- (2) registrovan email → 'exists'
SELECT is(
  public.guest_exists('aaaaaaaa-7777-7777-7777-777777777777', NULL, 'a@x.com'),
  'exists',
  'Postojeći regular gost (email) → exists');

-- (3) blacklist → 'exists' (ne otkriva blacklist)
SELECT is(
  public.guest_exists('aaaaaaaa-7777-7777-7777-777777777777', '222', NULL),
  'exists',
  'Blacklist gost → exists (status se ne otkriva)');

-- (4) nepostojeći kontakt → 'none'
SELECT is(
  public.guest_exists('aaaaaaaa-7777-7777-7777-777777777777', '999', NULL),
  'none',
  'Nepostojeći kontakt → none');

-- (5) izolacija: isti broj '111' kod restorana B je njegov vip, ne A-ov pending
SELECT is(
  public.guest_exists('bbbbbbbb-7777-7777-7777-777777777777', '111', NULL),
  'exists',
  'Isti telefon kod drugog restorana → njegov status (izolacija), ne A-ov pending');

SELECT * FROM finish();
ROLLBACK;
