-- ============================================================================
-- Realtime za narudžbe — orders u supabase_realtime publikaciji + REPLICA IDENTITY FULL
-- ----------------------------------------------------------------------------
-- BUG: orders NIJE bio u supabase_realtime publikaciji, pa postgres_changes kanali
-- (waiter-portal / kitchen-portal / bar-portal) NIKAD nisu primali evente — nova/
-- izmijenjena narudžba se nije pojavljivala bez ručnog refresh-a. Dodajemo orders u
-- publikaciju i postavljamo REPLICA IDENTITY FULL (staff radi UPDATE statusa/stanica,
-- pa filter/old-record na UPDATE eventima zahtijeva pune kolone). CLAUDE.md §7.
-- Idempotentno: ALTER PUBLICATION ADD TABLE pukne ako je tabela već član.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
