-- ════════════════════════════════════════════════════════════════════════
-- INVENTORY PRO v2 — Faza 2: Narudžbenice (purchase orders)
--   • purchase_orders + purchase_order_items (per-tenant, owner-only RLS)
--   • PO broj — atomarna numeracija po tenantu (advisory lock + max+1)
--   • receive_purchase_order() — primka: qty_received → inventory_movements 'purchase'
--   • generate_reorder_drafts() — auto-draft niskih zaliha grupisan po dobavljaču
--   • Gating: inventory_pro addon (frontend). RLS = owner-only (kao inventory_items).
-- ════════════════════════════════════════════════════════════════════════

-- ── Proširi izvor kretanja: dodaj 'purchase' (primka narudžbenice) ──────────
-- Postojeći check je dopuštao samo 'manual'/'order'. Primka upisuje 'purchase'.
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_source_check;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IN ('manual', 'order', 'purchase'));

-- ── purchase_orders ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- Dobavljač je opcioni (auto-prijedlog za stavke bez dobavljača ide na NULL).
  supplier_id    uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- Redni broj narudžbenice po tenantu (1,2,3…); dodjeljuje trigger.
  po_number      integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','approved','sent','partial','received','cancelled')),
  order_date     date NOT NULL DEFAULT CURRENT_DATE,
  expected_date  date,
  received_date  date,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, po_number)
);

COMMENT ON TABLE public.purchase_orders IS
  'Narudžbenice prema dobavljačima (Inventory Pro v2). po_number jedinstven po tenantu. Owner-only RLS.';

CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant ON public.purchase_orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier   ON public.purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status     ON public.purchase_orders (restaurant_id, status);

-- ── purchase_order_items ─────────────────────────────────────────────────────
-- restaurant_id je dupliran (defense in depth + jednostavan RLS bez join-a).
-- item_name/unit su snapshot — preživljavaju brisanje inventory_items (FK SET NULL).
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  restaurant_id     uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name         text NOT NULL,
  unit              text,
  qty_ordered       numeric(10,3) NOT NULL DEFAULT 0,
  qty_received      numeric(10,3) NOT NULL DEFAULT 0,
  unit_price        numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_order_items IS
  'Stavke narudžbenice. item_name/unit = snapshot da istorija preživi brisanje stavke zalihe.';

CREATE INDEX IF NOT EXISTS idx_po_items_po         ON public.purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_restaurant ON public.purchase_order_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_po_items_item       ON public.purchase_order_items (item_id);

-- ── RLS (owner-only, ogledalo inventory_items / suppliers) ───────────────────
ALTER TABLE public.purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja narudžbenicama" ON public.purchase_orders
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Vlasnik upravlja stavkama narudžbenice" ON public.purchase_order_items
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- ── updated_at touch ─────────────────────────────────────────────────────────
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_suppliers_updated_at();

-- ── PO broj: atomarna numeracija po tenantu ──────────────────────────────────
-- ZAŠTO: po_number mora biti jedinstven i rastući po tenantu bez rupa od konkurentnih
-- insert-a. Advisory lock (po restaurant_id) serijalizuje dodjelu unutar transakcije.
CREATE OR REPLACE FUNCTION public.assign_po_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('po_number_' || NEW.restaurant_id::text));
    SELECT COALESCE(MAX(po_number), 0) + 1
      INTO NEW.po_number
      FROM public.purchase_orders
      WHERE restaurant_id = NEW.restaurant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_po_number
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_po_number();

-- ── Primka: receive_purchase_order(po_id, lines) ─────────────────────────────
-- lines = [{ "id": <poi_uuid>, "qty_received": <num> }]
-- Za svaku stavku: delta = nova_primljena - dosad_primljena → upiše se kao
-- inventory_movements ('purchase') i ažurira inventory_items.quantity. Status PO-a:
-- 'received' ako su SVE stavke primljene u punoj količini, inače 'partial'.
-- SECURITY INVOKER (default) → RLS na svim tabelama štiti tenant izolaciju.
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid, p_lines jsonb)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_po           public.purchase_orders%ROWTYPE;
  v_line         jsonb;
  v_poi          public.purchase_order_items%ROWTYPE;
  v_new_received numeric;
  v_delta        numeric;
  v_before       numeric;
  v_after        numeric;
  v_all_received boolean;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Narudžbenica ne postoji ili nije dostupna';
  END IF;
  IF v_po.status IN ('received', 'cancelled') THEN
    RAISE EXCEPTION 'Narudžbenica je već zatvorena (status: %)', v_po.status;
  END IF;

  FOR v_line IN SELECT jsonb_array_elements(p_lines) LOOP
    SELECT * INTO v_poi
      FROM public.purchase_order_items
      WHERE id = (v_line->>'id')::uuid AND purchase_order_id = p_po_id;
    CONTINUE WHEN NOT FOUND;

    v_new_received := COALESCE((v_line->>'qty_received')::numeric, v_poi.qty_received);
    v_delta := v_new_received - v_poi.qty_received;

    UPDATE public.purchase_order_items
      SET qty_received = v_new_received
      WHERE id = v_poi.id;

    -- Knjiži kretanje zalihe samo ako ima promjene i stavka je vezana na zalihu.
    IF v_delta <> 0 AND v_poi.item_id IS NOT NULL THEN
      SELECT quantity INTO v_before FROM public.inventory_items
        WHERE id = v_poi.item_id FOR UPDATE;
      v_after := GREATEST(0, v_before + v_delta);

      UPDATE public.inventory_items
        SET quantity = v_after, updated_at = now()
        WHERE id = v_poi.item_id;

      INSERT INTO public.inventory_movements (
        restaurant_id, item_id, type, quantity,
        quantity_before, quantity_after, source, note
      ) VALUES (
        v_po.restaurant_id, v_poi.item_id,
        CASE WHEN v_delta >= 0 THEN 'in' ELSE 'out' END, abs(v_delta),
        v_before, v_after, 'purchase',
        'Primka narudžbenice #' || v_po.po_number
      );
    END IF;
  END LOOP;

  SELECT bool_and(qty_received >= qty_ordered) INTO v_all_received
    FROM public.purchase_order_items WHERE purchase_order_id = p_po_id;

  UPDATE public.purchase_orders SET
    status        = CASE WHEN v_all_received THEN 'received' ELSE 'partial' END,
    received_date = CASE WHEN v_all_received THEN CURRENT_DATE ELSE received_date END,
    updated_at    = now()
  WHERE id = p_po_id;
END;
$$;

COMMENT ON FUNCTION public.receive_purchase_order(uuid, jsonb) IS
  'Primka narudžbenice: knjiži delta primljene količine u inventory_movements (purchase) i ažurira stanje. SECURITY INVOKER → RLS štiti tenant.';

-- ── Auto-prijedlog: generate_reorder_drafts(restaurant_id) ───────────────────
-- Niske zalihe (quantity < min_quantity, min>0) koje NISU već u otvorenoj
-- narudžbenici → grupiše po preferiranom dobavljaču i kreira draft PO po grupi.
-- Predložena količina: do 2× minimuma (GREATEST(min*2 - qty, min)). Vraća broj PO-a.
CREATE OR REPLACE FUNCTION public.generate_reorder_drafts(p_restaurant_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_grp   record;
  v_po_id uuid;
  v_count integer := 0;
BEGIN
  -- Eksplicitna provjera vlasništva (param se ne filtrira RLS-om kao auth kontekst).
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nedovoljna prava za ovaj nalog';
  END IF;

  FOR v_grp IN
    SELECT ii.supplier_id
    FROM public.inventory_items ii
    WHERE ii.restaurant_id = p_restaurant_id
      AND ii.min_quantity > 0
      AND ii.quantity < ii.min_quantity
      AND NOT EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
        WHERE poi.item_id = ii.id
          AND po.status IN ('draft','approved','sent','partial')
      )
    GROUP BY ii.supplier_id
  LOOP
    INSERT INTO public.purchase_orders (restaurant_id, supplier_id, status, note)
      VALUES (p_restaurant_id, v_grp.supplier_id, 'draft', 'Automatski prijedlog — niske zalihe')
      RETURNING id INTO v_po_id;

    INSERT INTO public.purchase_order_items (
      purchase_order_id, restaurant_id, item_id, item_name, unit, qty_ordered, unit_price
    )
    SELECT v_po_id, p_restaurant_id, ii.id, ii.name, ii.unit,
           GREATEST(ii.min_quantity * 2 - ii.quantity, ii.min_quantity), ii.cost_per_unit
    FROM public.inventory_items ii
    WHERE ii.restaurant_id = p_restaurant_id
      AND ii.min_quantity > 0
      AND ii.quantity < ii.min_quantity
      AND ii.supplier_id IS NOT DISTINCT FROM v_grp.supplier_id
      AND NOT EXISTS (
        SELECT 1 FROM public.purchase_order_items poi
        JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
        WHERE poi.item_id = ii.id
          AND po.status IN ('draft','approved','sent','partial')
      );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.generate_reorder_drafts(uuid) IS
  'Kreira draft narudžbenice za niske zalihe grupisane po dobavljaču (preskače stavke koje su već u otvorenoj PO). SECURITY INVOKER + ručna provjera vlasništva.';

-- ── Realtime nije potreban (PO uređuje samo owner u svojoj sesiji). ───────────
