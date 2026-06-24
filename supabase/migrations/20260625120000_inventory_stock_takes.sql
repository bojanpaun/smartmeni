-- ════════════════════════════════════════════════════════════════════════
-- INVENTORY PRO v2 — Faza 3: Inventura (stock takes)
--   • stock_takes + stock_take_items (per-tenant, owner-only RLS)
--   • create_stock_take() — snapshot trenutnog stanja u stavke inventure
--   • close_stock_take() — adjustment → inventory_movements 'stocktake' + zaključavanje
--   • period lock — zaključena inventura i njene stavke se više ne mijenjaju (trigger)
--   • Gating: inventory_pro addon (frontend). RLS = owner-only (kao inventory_items).
-- ════════════════════════════════════════════════════════════════════════

-- ── Proširi izvor kretanja: dodaj 'stocktake' (korekcija iz inventure) ───────
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_source_check;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IN ('manual', 'order', 'purchase', 'stocktake'));

-- ── stock_takes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_takes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name             text,
  -- opcioni filter po kategoriji zalihe (NULL = sve kategorije)
  category         text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  take_date        date NOT NULL DEFAULT CURRENT_DATE,
  note             text,
  -- vrijednosni iskaz razlike (Σ (counted − expected) × nabavna cijena), upisuje close
  total_diff_value numeric(12,2),
  closed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_takes IS
  'Inventure (Inventory Pro v2). Zaključena (closed) je nepromjenjiva — period lock trigger. Owner-only RLS.';

CREATE INDEX IF NOT EXISTS idx_stock_takes_restaurant ON public.stock_takes (restaurant_id);

-- ── stock_take_items ─────────────────────────────────────────────────────────
-- expected_qty/cost_per_unit = snapshot u trenutku kreiranja (osnova za razliku).
-- item_name/unit = snapshot da izvještaj preživi brisanje stavke zalihe.
CREATE TABLE IF NOT EXISTS public.stock_take_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_take_id  uuid NOT NULL REFERENCES public.stock_takes(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  item_id        uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name      text NOT NULL,
  unit           text,
  expected_qty   numeric(10,3) NOT NULL DEFAULT 0,
  counted_qty    numeric(10,3),                 -- NULL dok se ne prebroji
  cost_per_unit  numeric(10,2),
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stock_take_items IS
  'Stavke inventure. expected_qty = evidentirano stanje (snapshot), counted_qty = stvarno prebrojano.';

CREATE INDEX IF NOT EXISTS idx_sti_stock_take ON public.stock_take_items (stock_take_id);
CREATE INDEX IF NOT EXISTS idx_sti_restaurant ON public.stock_take_items (restaurant_id);

-- ── RLS (owner-only) ─────────────────────────────────────────────────────────
ALTER TABLE public.stock_takes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja inventurama" ON public.stock_takes
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Vlasnik upravlja stavkama inventure" ON public.stock_take_items
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- ── updated_at touch ─────────────────────────────────────────────────────────
CREATE TRIGGER trg_stock_takes_updated_at
  BEFORE UPDATE ON public.stock_takes
  FOR EACH ROW EXECUTE FUNCTION public.touch_suppliers_updated_at();

-- ── Period lock ──────────────────────────────────────────────────────────────
-- ZAŠTO: zaključena inventura je revizorski zapis. Jednom kad je 'closed', ni ona ni
-- njene stavke se ne smiju mijenjati (zabrana reotvaranja / prepravke prebrojanog).
CREATE OR REPLACE FUNCTION public.guard_stock_take_closed()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'Zaključena inventura se ne može mijenjati';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_take_closed_lock
  BEFORE UPDATE ON public.stock_takes
  FOR EACH ROW EXECUTE FUNCTION public.guard_stock_take_closed();

CREATE OR REPLACE FUNCTION public.guard_stock_take_items_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.stock_takes
    WHERE id = COALESCE(NEW.stock_take_id, OLD.stock_take_id);
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'Inventura je zaključena — stavke se ne mogu mijenjati';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_stock_take_items_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.stock_take_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_stock_take_items_lock();

-- ── create_stock_take(restaurant_id, name, category) ─────────────────────────
-- Kreira inventuru i snima trenutno stanje svih (ili kategorije) stavki zalihe.
-- SECURITY INVOKER → RLS štiti tenant; uz to ručna provjera vlasništva (param).
CREATE OR REPLACE FUNCTION public.create_stock_take(
  p_restaurant_id uuid, p_name text DEFAULT NULL, p_category text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nedovoljna prava za ovaj nalog';
  END IF;

  INSERT INTO public.stock_takes (restaurant_id, name, category, status)
    VALUES (p_restaurant_id, NULLIF(btrim(COALESCE(p_name,'')), ''), NULLIF(p_category,''), 'open')
    RETURNING id INTO v_id;

  INSERT INTO public.stock_take_items (
    stock_take_id, restaurant_id, item_id, item_name, unit, expected_qty, cost_per_unit
  )
  SELECT v_id, p_restaurant_id, ii.id, ii.name, ii.unit, ii.quantity, ii.cost_per_unit
  FROM public.inventory_items ii
  WHERE ii.restaurant_id = p_restaurant_id
    AND (p_category IS NULL OR p_category = '' OR ii.category = p_category)
  ORDER BY ii.category, ii.name;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.create_stock_take(uuid, text, text) IS
  'Kreira inventuru i snapshotuje stanje (i nabavnu cijenu) svih ili odabrane kategorije stavki zalihe.';

-- ── close_stock_take(stock_take_id) ──────────────────────────────────────────
-- Za svaku prebrojanu stavku (counted_qty NOT NULL) gdje se razlikuje od živog stanja:
-- knjiži 'adjustment' (source 'stocktake') i postavlja stanje na prebrojano. Upisuje
-- total_diff_value i zaključava inventuru. SECURITY INVOKER → RLS štiti tenant.
CREATE OR REPLACE FUNCTION public.close_stock_take(p_stock_take_id uuid)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
  v_st     public.stock_takes%ROWTYPE;
  v_sti    public.stock_take_items%ROWTYPE;
  v_before numeric;
  v_total  numeric := 0;
BEGIN
  SELECT * INTO v_st FROM public.stock_takes WHERE id = p_stock_take_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventura ne postoji ili nije dostupna';
  END IF;
  IF v_st.status = 'closed' THEN
    RAISE EXCEPTION 'Inventura je već zaključena';
  END IF;

  FOR v_sti IN
    SELECT * FROM public.stock_take_items
    WHERE stock_take_id = p_stock_take_id AND counted_qty IS NOT NULL
  LOOP
    v_total := v_total + (v_sti.counted_qty - v_sti.expected_qty) * COALESCE(v_sti.cost_per_unit, 0);

    IF v_sti.item_id IS NOT NULL THEN
      SELECT quantity INTO v_before FROM public.inventory_items
        WHERE id = v_sti.item_id FOR UPDATE;

      IF v_before IS DISTINCT FROM v_sti.counted_qty THEN
        UPDATE public.inventory_items
          SET quantity = v_sti.counted_qty, updated_at = now()
          WHERE id = v_sti.item_id;

        INSERT INTO public.inventory_movements (
          restaurant_id, item_id, type, quantity,
          quantity_before, quantity_after, source, note
        ) VALUES (
          v_st.restaurant_id, v_sti.item_id, 'adjustment', v_sti.counted_qty,
          v_before, v_sti.counted_qty, 'stocktake',
          'Inventura: ' || COALESCE(v_st.name, to_char(v_st.take_date, 'YYYY-MM-DD'))
        );
      END IF;
    END IF;
  END LOOP;

  UPDATE public.stock_takes SET
    status = 'closed', closed_at = now(), total_diff_value = v_total, updated_at = now()
  WHERE id = p_stock_take_id;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.close_stock_take(uuid) IS
  'Zaključuje inventuru: knjiži korekcije stanja (adjustment/stocktake) i upisuje vrijednosnu razliku. Nakon ovoga period lock sprječava izmjene.';
