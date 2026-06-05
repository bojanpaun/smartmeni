-- ============================================================================
-- Sloj 1 — META-GUARD: RLS mora biti uključen na SVIM tabelama u 'public'
-- ----------------------------------------------------------------------------
-- Ovo je "samoodržavajući" test: NE mijenjaš ga kad dodaš tabelu. Čim nova
-- tabela zaboravi `ENABLE ROW LEVEL SECURITY`, OVAJ test pukne — automatski
-- pokriva cijelu šemu i direktno čuva pravilo §1 (multi-tenancy).
--
-- Pita pg_catalog (stvarno stanje baze), ne tekst migracija — zato je pouzdan
-- tamo gdje grep nije.
--
-- Ako ikad namjerno napraviš tabelu BEZ RLS (npr. javni katalog), ovaj test će
-- je prijaviti — to je namjerno: tjera na svjesnu odluku. Tada je dokumentuj.
--
-- NAPOMENA o views: vendorovani tests.rls_enabled('public') broji i poglede
-- (relkind='v'), a oni NE MOGU imati RLS (nasljeđuju ga od baznih tabela kroz
-- security_invoker). Zato ovdje asertiramo direktno samo nad običnim tabelama
-- (relkind='r') — isti meta-guard, bez lažnih prijava za poglede
-- (hotel_daily_revenue, spa_analytics_monthly).
--
-- Pokretanje: supabase test db
-- ============================================================================

BEGIN;
-- tests.* helperi: iz 0000_setup_test_helpers.sql (učitava se prvi)

SELECT plan(1);

-- Broj OBIČNIH tabela (ne views/matviews) u public bez RLS-a mora biti 0.
SELECT is(
  (SELECT count(*)::int
     FROM pg_class pc
     JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE pc.relkind = 'r'
      AND pc.relrowsecurity = false),
  0,
  'Sve tabele u public šemi imaju uključen RLS (views se ne računaju)'
);

SELECT * FROM finish();
ROLLBACK;
