-- ============================================================================
-- Sloj 1 — META-GUARD: nijedan tenant red ne smije imati restaurant_id IS NULL
-- ----------------------------------------------------------------------------
-- Generalizacija buga iz create_spa_folio_item (SECURITY DEFINER trigger koji je
-- tiho upisivao folio_items s restaurant_id = NULL → orphan, nevidljiv kroz RLS).
--
-- "Samoodržavajući": automatski pokriva SVE tabele u public koje imaju kolonu
-- restaurant_id — ne mijenjaš test kad dodaš tenant tabelu. Čim bilo koji put
-- (trigger, RPC, edge fn, klijent) ubaci red bez restaurant_id, OVAJ test pukne.
--
-- Pita stvarno stanje baze (pg_catalog + dinamički COUNT), ne tekst migracija.
-- Komplementaran s 000_rls_enabled_all_tables (RLS uključen) i 003 (spa folio).
--
-- NAPOMENA: na praznoj test bazi prolazi trivijalno (0 redova); punu vrijednost
-- daje kad testovi/seed ubace podatke ili kad NOT NULL guard još ne pokriva tabelu.
--
-- Pokretanje: supabase test db
-- ============================================================================

BEGIN;
-- tests.* helperi: iz 0000_setup_test_helpers.sql (učitava se prvi)

SELECT plan(1);

-- Dinamički prebroji NULL restaurant_id redove kroz SVE tenant tabele.
CREATE OR REPLACE FUNCTION pg_temp.count_orphan_tenant_rows()
RETURNS bigint AS $$
DECLARE
  r     record;
  total bigint := 0;
  n     bigint;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_attribute a
    JOIN pg_class c     ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE a.attname = 'restaurant_id'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE restaurant_id IS NULL', r.relname)
    INTO n;
    total := total + n;
  END LOOP;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

SELECT is(
  pg_temp.count_orphan_tenant_rows()::int,
  0,
  'Nijedna tenant tabela nema red s restaurant_id IS NULL (orphan/tenant-leak guard)'
);

SELECT * FROM finish();
ROLLBACK;
