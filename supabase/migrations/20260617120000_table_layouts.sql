-- ============================================================================
-- TABLE_LAYOUTS — više imenovanih rasporeda stolova po restoranu (Faza 1, eventi)
-- ----------------------------------------------------------------------------
-- Do sada: jedan ravan skup `tables` po restoranu. Sada: svaki `tables` red
-- pripada tačno jednom `table_layouts` redu. TAČNO JEDAN layout po restoranu je
-- is_active=true u svakom trenutku — to je raspored koji koriste live operativni
-- pogledi (WaiterMapView, StaffPortal unos narudžbe, online rezervacije,
-- analitika). Garantovano DB-om (partial unique index), ne app logikom.
--
-- ZAŠTO: omogućava pripremu „event" rasporeda (npr. svadba 120 osoba) kao DRAFT
-- pored standardnog, bez da se pokvari živi rad. Prebacivanje je atomično preko
-- RPC-a (set_active_table_layout) — direktan UPDATE is_active iz frontenda bi
-- pukao na partial unique indexu ako se ne uradi u tačnom redoslijedu.
--
-- KRITIČNO ograničenje koje je oblikovalo dizajn: orders/waiter_requests.table_number
-- su PLAIN TEXT (ne FK) i poklapaju se sa stolom string-matchom GLOBALNO po
-- restoranu. Zato live tok mora uvijek gledati tačno JEDAN skup stolova (aktivan
-- layout), nikad uniju — inače bi dva layout-a sa istim brojem stola dala duple
-- prikaze. Live čitači zato filtriraju po is_active layoutu.
-- ============================================================================

-- ── 1. Tabela ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.table_layouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.table_layouts IS
  'Imenovani raspored stolova. Tačno jedan is_active=true po restoranu (partial unique index) = layout za live rad. Ostali su draft/event rasporedi. Prebacivanje aktivnog SAMO preko set_active_table_layout().';

CREATE INDEX IF NOT EXISTS idx_table_layouts_restaurant ON public.table_layouts(restaurant_id);
-- INVARIANT: najviše jedan aktivan layout po restoranu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_layouts_one_active
  ON public.table_layouts(restaurant_id) WHERE is_active;

-- ── 2. tables.layout_id ─────────────────────────────────────────────────────
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS layout_id uuid REFERENCES public.table_layouts(id) ON DELETE CASCADE;

-- ── 3. Backfill: svaki restoran sa stolovima dobija „Standardni raspored" ────
-- (i svaki restoran uopšte — da svjež nalog ima aktivan layout odmah). Tačno
-- jedan aktivan po restoranu; postojeći stolovi se vežu na njega.
DO $$
DECLARE r record; v_layout uuid;
BEGIN
  FOR r IN SELECT id FROM public.restaurants LOOP
    IF NOT EXISTS (SELECT 1 FROM public.table_layouts WHERE restaurant_id = r.id) THEN
      INSERT INTO public.table_layouts (restaurant_id, name, is_active)
      VALUES (r.id, 'Standardni raspored', true)
      RETURNING id INTO v_layout;
      UPDATE public.tables SET layout_id = v_layout
        WHERE restaurant_id = r.id AND layout_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- Stolovi bez restorana-layouta (teorijski) ne smiju ostati — ali svi restorani
-- su prošli backfill, pa je sigurno postaviti NOT NULL.
ALTER TABLE public.tables ALTER COLUMN layout_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_layout ON public.tables(layout_id);

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.table_layouts ENABLE ROW LEVEL SECURITY;

-- Javno čitljiv SAMO aktivan layout (guest online rezervacija razrešava aktivan
-- layout anonimno). Draft/event imena (npr. „Svadba — Marko i Ana") NE curе anon
-- korisnicima — njih vidi samo vlasnik. (Razlika u odnosu na `tables` koji je sav
-- javan; ovdje suzujemo da se privatna imena evenata ne enumerišu.)
CREATE POLICY "Aktivan layout je javan"
  ON public.table_layouts FOR SELECT
  USING (is_active = true
         OR restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin());

-- Vlasnik upravlja svojim layout-ima (insert/update/delete). Superadmin sve.
CREATE POLICY "Vlasnik upravlja layout-ima"
  ON public.table_layouts FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

CREATE TRIGGER table_layouts_updated_at
  BEFORE UPDATE ON public.table_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL ON TABLE public.table_layouts TO anon;
GRANT ALL ON TABLE public.table_layouts TO authenticated;
GRANT ALL ON TABLE public.table_layouts TO service_role;

-- ── 5. RPC: atomarno prebaci aktivan layout ─────────────────────────────────
-- SECURITY DEFINER jer partial unique index zahtijeva da se stari deaktivira PRIJE
-- nego se novi aktivira (jedan UPDATE „vidi sve, piši svoje" RLS ne pokriva čisto).
-- Ownership se provjerava eksplicitno unutar funkcije (nije shortcut — CLAUDE.md §1).
CREATE OR REPLACE FUNCTION public.set_active_table_layout(
  p_restaurant_id uuid, p_layout_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = p_restaurant_id AND r.user_id = auth.uid())
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM table_layouts WHERE id = p_layout_id AND restaurant_id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Layout ne pripada restoranu' USING ERRCODE = '22023';
  END IF;
  -- Redoslijed bitan: prvo skini stari aktivan, pa postavi novi (partial unique).
  UPDATE table_layouts SET is_active = false
    WHERE restaurant_id = p_restaurant_id AND is_active AND id <> p_layout_id;
  UPDATE table_layouts SET is_active = true WHERE id = p_layout_id;
END; $$;
COMMENT ON FUNCTION public.set_active_table_layout(uuid, uuid) IS
  'Atomarno prebacuje aktivan raspored stolova (deaktivira stari, aktivira novi). Jedini dozvoljeni način mijenjanja is_active.';
REVOKE ALL ON FUNCTION public.set_active_table_layout(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_active_table_layout(uuid, uuid) TO authenticated;

-- ── 6. RPC: dupliraj layout + sve njegove stolove kao draft ─────────────────
CREATE OR REPLACE FUNCTION public.duplicate_table_layout(
  p_layout_id uuid, p_new_name text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid; v_new uuid;
BEGIN
  SELECT restaurant_id INTO v_rest FROM table_layouts WHERE id = p_layout_id;
  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Layout ne postoji' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = v_rest AND r.user_id = auth.uid())
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;

  INSERT INTO table_layouts (restaurant_id, name, is_active)
  VALUES (v_rest, p_new_name, false)        -- klon je uvijek DRAFT
  RETURNING id INTO v_new;

  INSERT INTO tables (restaurant_id, layout_id, number, label, x, y, width, height, shape, seats, status)
  SELECT restaurant_id, v_new, number, label, x, y, width, height, shape, seats, 'free'
    FROM tables WHERE layout_id = p_layout_id;

  RETURN v_new;
END; $$;
COMMENT ON FUNCTION public.duplicate_table_layout(uuid, text) IS
  'Klonira layout i sve njegove stolove pod novim imenom kao draft (is_active=false). Status kloniranih stolova resetovan na free. Vraća id novog layouta.';
REVOKE ALL ON FUNCTION public.duplicate_table_layout(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_table_layout(uuid, text) TO authenticated;
