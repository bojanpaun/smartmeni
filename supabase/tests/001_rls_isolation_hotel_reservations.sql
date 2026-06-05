-- ============================================================================
-- Sloj 1 — DB test: RLS izolacija na hotel_reservations
-- ----------------------------------------------------------------------------
-- Provjerava NAJVAŽNIJI sigurnosni invariant aplikacije:
-- jedan tenant (restaurant_id) NE SMIJE vidjeti ni pisati podatke drugog tenanta.
-- RLS regresija = curenje podataka između klijenata.
--
-- Testira politiku iz 20260528000004_hotel_core.sql:
--   "Owner manages hotel_reservations" FOR ALL
--   USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
--
-- Ovaj fajl je ŠABLON — kopiraj ga za svaku kritičnu tabelu (guests, folios,
-- orders, spa_appointments...) i zamijeni naziv tabele + minimalne kolone.
--
-- Cijeli test radi u BEGIN ... ROLLBACK — NE dira tvoje prave podatke.
-- Pokretanje:  supabase test db
-- ============================================================================

BEGIN;

-- tests.* helperi (create_supabase_user / authenticate_as / get_supabase_uid /
-- rls_enabled) dolaze iz 0000_setup_test_helpers.sql, koji se učitava prvi.

SELECT plan(5);

-- ── Setup (kao postgres superuser — RLS se zaobilazi pri seedovanju) ────────
-- Dva vlasnika = dva tenanta.
SELECT tests.create_supabase_user('owner_a');
SELECT tests.create_supabase_user('owner_b');

-- Po jedan restoran (tenant) za svakog vlasnika.
INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Hotel A', 'hotel-a-test'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_b'), 'Hotel B', 'hotel-b-test');

-- Po jedna rezervacija u svakom tenantu (minimalne NOT NULL kolone).
INSERT INTO hotel_reservations (restaurant_id, check_in_date, check_out_date, guest_name) VALUES
  ('11111111-1111-1111-1111-111111111111', '2026-07-01', '2026-07-05', 'Gost tenanta A'),
  ('22222222-2222-2222-2222-222222222222', '2026-07-02', '2026-07-06', 'Gost tenanta B');

-- ── Test 0: RLS je uopšte uključen na tabeli ───────────────────────────────
SELECT tests.rls_enabled('public', 'hotel_reservations');

-- ── Ulogujemo se kao Vlasnik A ─────────────────────────────────────────────
SELECT tests.authenticate_as('owner_a');

-- Test 1: vidi tačno 1 red (svoj), ne oba.
SELECT results_eq(
  'SELECT count(*)::int FROM hotel_reservations',
  ARRAY[1],
  'Vlasnik A vidi tačno svoju 1 rezervaciju (ne 2)'
);

-- Test 2: taj red je baš njegov.
SELECT results_eq(
  $$ SELECT guest_name FROM hotel_reservations $$,
  $$ VALUES ('Gost tenanta A') $$,
  'Vlasnik A vidi svoju rezervaciju'
);

-- Test 3: NE vidi rezervaciju tenanta B, čak ni eksplicitnim filterom.
SELECT is_empty(
  $$ SELECT 1 FROM hotel_reservations WHERE guest_name = 'Gost tenanta B' $$,
  'Vlasnik A NE vidi rezervaciju tenanta B (čitanje izolovano)'
);

-- Test 4: NE može upisati red u tuđi tenant (WITH CHECK iz FOR ALL politike).
-- RLS prekršaj podiže SQLSTATE 42501.
SELECT throws_ok(
  $$ INSERT INTO hotel_reservations (restaurant_id, check_in_date, check_out_date, guest_name)
     VALUES ('22222222-2222-2222-2222-222222222222', '2026-08-01', '2026-08-03', 'Ubačeno od A') $$,
  '42501',
  NULL,
  'Vlasnik A NE može ubaciti rezervaciju u tenant B (pisanje izolovano)'
);

SELECT tests.clear_authentication();

SELECT * FROM finish();
ROLLBACK;
