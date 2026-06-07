-- ============================================================================
-- Sloj 1 — STRUKTURNI GUARD tenant veze (sigurnosna mreža za 2b)
-- ----------------------------------------------------------------------------
-- Svaka tabela s kolonom restaurant_id mora:
--   (1) imati restaurant_id NOT NULL  (nema orphan/tenant-leak),
--   (2) imati FK s te kolone na restaurants(id)  (nema slobodnih UUID veza).
-- Samoodržavajući (pita pg_catalog). Pri migraciji na tenants/properties (2b)
-- ovaj test je referentni: ažurira se da gađa novu tenant tabelu i odmah
-- otkriva svaku tabelu kojoj je repoint FK/NOT NULL promakao.
--
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(2);

-- (1) Nijedna restaurant_id kolona ne smije biti nullable.
SELECT is(
  (SELECT count(*)::int
     FROM pg_attribute a
     JOIN pg_class c     ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE a.attname = 'restaurant_id'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND c.relkind = 'r'
      AND NOT a.attnotnull),
  0,
  'Sve restaurant_id kolone su NOT NULL'
);

-- (2) Svaka tabela s restaurant_id ima FK na restaurants(id).
SELECT is(
  (SELECT count(*)::int
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = c.oid AND a.attname = 'restaurant_id'
           AND a.attnum > 0 AND NOT a.attisdropped)
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint k
         WHERE k.conrelid = c.oid AND k.contype = 'f'
           AND k.confrelid = 'public.restaurants'::regclass
           AND k.conkey = ARRAY[(SELECT a2.attnum FROM pg_attribute a2
                                  WHERE a2.attrelid = c.oid AND a2.attname = 'restaurant_id')])),
  0,
  'Svaka tabela s restaurant_id ima FK na restaurants(id)'
);

SELECT * FROM finish();
ROLLBACK;
