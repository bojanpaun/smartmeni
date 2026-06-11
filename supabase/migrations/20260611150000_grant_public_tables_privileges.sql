-- ============================================================================
-- GRANT-ovi za sve public tabele + default privilegije (šema samodovoljna)
-- ----------------------------------------------------------------------------
-- ZAŠTO: baseline (20260527000000, pg_dump) grantovao je PER-TABELU samo tabele
-- koje su tada postojale. Tabele iz kasnijih migracija (hotel_reservations,
-- folio_items, folios, tenants, theme_palettes, spa_*, minibar_*, support_*,
-- platform_announcements, staff_announcements, breakfast_log, subscriptions ...)
-- nisu imale eksplicitan GRANT — oslanjale su se na auto-grant iz STARIJE
-- Supabase postgres slike (ALTER DEFAULT PRIVILEGES koji starija slika postavlja).
--
-- NOVIJA slika (CI koristi `supabase/setup-cli@latest`) to više ne radi
-- automatski → `supabase test db` na čistoj bazi puca s
-- "permission denied for table ..." za role `authenticated`/`service_role`,
-- iako lokalno (starija CLI/slika) prolazi. Ova migracija čini šemu nezavisnom
-- od podrazumijevanih grantova slike.
--
-- SIGURNOST: grant je namjerno širok (anon/authenticated/service_role) — isto kao
-- u baseline-u. JEDINA granica zaštite ostaje RLS (sve tabele imaju RLS enabled,
-- vidi test 000_rls_enabled_all_tables); GRANT samo dozvoljava da RLS uopšte
-- evaluira politike. Funkcije ne diramo (Postgres ionako daje EXECUTE PUBLIC-u).
-- Idempotentno (GRANT/ALTER DEFAULT PRIVILEGES) → bezbjedno i za `db push` na prod.
-- ============================================================================

-- Postojeće tabele i sekvence
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Buduće tabele/sekvence (kreirane od strane role koja vrti migracije = postgres)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
