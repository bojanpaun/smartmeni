-- ============================================================================
-- TABLE_ASSIGNMENTS — dodjela stola konobaru po danu (Faza 2, eventi/operativa)
-- ----------------------------------------------------------------------------
-- Jedan red = „sto T je dodijeljen konobaru S za datum D". Omogućava „Moji stolovi"
-- filter u WaiterMapView (konobar vidi samo svoje) i raspoređivanje osoblja po
-- stolovima (npr. svadba: konobar 1 → stolovi 1–5).
--
-- ODLUKE (v. docs/spec-stolovi-eventi.md §5):
--   • NEMA FK na work_schedules — konobar može biti dodijeljen i bez formalne smjene
--     (mala kafana bez HR modula). Granularnost smjene (shift_id) doda se TEK ako
--     zatreba (dvije smjene istog stola istog dana) — YAGNI za sada.
--   • event_id (veza na events) doda se u Fazi 3 kad tabela events postoji — ne
--     pravimo dangling nullable uuid bez FK unaprijed.
--   • unique (table_id, date) — jedan sto, jedan konobar po danu.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.table_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      uuid NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date          date NOT NULL,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT table_assignments_uniq UNIQUE (table_id, date)
);

COMMENT ON TABLE public.table_assignments IS
  'Dodjela stola konobaru po danu. unique (table_id, date) = jedan sto, jedan konobar po danu. Bez FK na smjene (shift_id) i events — dodaju se kad zatrebaju.';

CREATE INDEX IF NOT EXISTS idx_table_assignments_lookup
  ON public.table_assignments (restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_table_assignments_staff
  ON public.table_assignments (staff_id, date);

ALTER TABLE public.table_assignments ENABLE ROW LEVEL SECURITY;

-- Vlasnik (i superadmin) upravlja dodjelama svog restorana.
CREATE POLICY "Vlasnik upravlja dodjelama stolova"
  ON public.table_assignments FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

-- Konobar ČITA samo SVOJE dodjele (za „Moji stolovi" filter u WaiterMapView).
-- staff.user_id = auth.uid() → njegove staff.id vrijednosti. Ne smije pisati (samo SELECT).
CREATE POLICY "Konobar vidi svoje dodjele"
  ON public.table_assignments FOR SELECT
  USING (staff_id IN (SELECT id FROM public.staff WHERE user_id = auth.uid()));

GRANT ALL ON TABLE public.table_assignments TO anon;
GRANT ALL ON TABLE public.table_assignments TO authenticated;
GRANT ALL ON TABLE public.table_assignments TO service_role;

-- Realtime: konobar odmah vidi promjenu dodjele bez refresh-a (CLAUDE.md §7).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'table_assignments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.table_assignments';
  END IF;
END $$;
ALTER TABLE public.table_assignments REPLICA IDENTITY FULL;
