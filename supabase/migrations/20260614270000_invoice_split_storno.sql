-- ============================================================================
-- FISK — razbijanje računa (split, oba moda) + storniranje (korektivni račun).
-- ----------------------------------------------------------------------------
-- Gradi na create_invoice_from_items (jedini autoritativni put za numeraciju/PDV).
--  • get_invoice_source_items  — vrati `items` niz izvora (za split UI: koje stavke).
--  • create_split_invoices     — N računa iz N grupa stavki, atomarno (jedan izvor →
--    više računa). Mod „po stavkama" i „jednaka podjela" oba se svode na grupe stavki
--    koje gradi frontend; DB samo kreira po jedan račun po grupi.
--  • create_storno_invoice     — korektivni (storno) račun: ogledalo originala sa
--    NEGATIVNIM iznosima, vezan preko corrective_for. Original OSTAJE (fiskalni zahtjev).
-- ============================================================================

-- Razlog storna (nema postojeće kolone; raw_provider_response je za FISK-3 provajdera).
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS correction_reason text;
COMMENT ON COLUMN public.invoices.correction_reason IS
  'Razlog storna/korekcije (popunjen samo na korektivnim računima, corrective_for IS NOT NULL).';

-- ── helper: ovlašćenje tenanta (vlasnik / aktivan staff / superadmin) ────────
CREATE OR REPLACE FUNCTION public._fisk_assert_tenant_access(p_restaurant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = p_restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff s WHERE s.restaurant_id = p_restaurant_id AND s.user_id = auth.uid() AND s.is_active)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno: korisnik ne pripada tenantu %', p_restaurant_id USING ERRCODE = '42501';
  END IF;
END; $$;

-- ── get_invoice_source_items: items niz za order/folio/spa ───────────────────
CREATE OR REPLACE FUNCTION public.get_invoice_source_items(
  p_restaurant_id uuid,
  p_source_type   text,
  p_source_id     uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_items jsonb;
BEGIN
  PERFORM public._fisk_assert_tenant_access(p_restaurant_id);

  IF p_source_type = 'order' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'name', oi.name, 'quantity', COALESCE(oi.quantity, 1),
             'unit_price_cents', round(oi.price * 100)::int,
             'vat_rate_key', COALESCE(mi.vat_rate_key, c.vat_rate_key)) ORDER BY oi.id), '[]'::jsonb)
      INTO v_items
    FROM order_items oi
    LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
    LEFT JOIN categories  c  ON c.id = mi.category_id
    WHERE oi.order_id = p_source_id
      AND EXISTS (SELECT 1 FROM orders o WHERE o.id = p_source_id AND o.restaurant_id = p_restaurant_id);

  ELSIF p_source_type = 'spa' THEN
    SELECT jsonb_build_array(jsonb_build_object(
             'name', s.name, 'quantity', 1,
             'unit_price_cents', round(a.price * 100)::int, 'vat_rate_key', s.vat_rate_key))
      INTO v_items
    FROM spa_appointments a JOIN spa_services s ON s.id = a.service_id
    WHERE a.id = p_source_id AND a.restaurant_id = p_restaurant_id;

  ELSIF p_source_type = 'folio' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'name', fi.description, 'quantity', COALESCE(fi.quantity, 1),
             'unit_price_cents', round(COALESCE(fi.unit_price, fi.total_price / NULLIF(fi.quantity, 0)) * 100)::int,
             'vat_rate_key', NULL) ORDER BY fi.id), '[]'::jsonb)
      INTO v_items
    FROM folio_items fi
    WHERE fi.folio_id = p_source_id
      AND EXISTS (SELECT 1 FROM folios f WHERE f.id = p_source_id AND f.restaurant_id = p_restaurant_id);
  ELSE
    RAISE EXCEPTION 'Nepoznat izvor %', p_source_type USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE(v_items, '[]'::jsonb);
END; $$;

COMMENT ON FUNCTION public.get_invoice_source_items IS
  'Vrati items niz [{name,quantity,unit_price_cents,vat_rate_key}] za order/folio/spa izvor (za split UI). Ownership-provjera.';

-- ── create_split_invoices: N grupa stavki → N računa (atomarno) ──────────────
-- p_groups = jsonb niz grupa; svaka grupa je `items` niz (kao create_invoice_from_items).
CREATE OR REPLACE FUNCTION public.create_split_invoices(
  p_restaurant_id uuid,
  p_source_type   text,
  p_source_id     uuid,
  p_groups        jsonb,
  p_enu_code      text DEFAULT 'DEFAULT',
  p_kind          text DEFAULT 'CASH_B2C'
) RETURNS SETOF public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group jsonb;
  v_idx   int := 0;
BEGIN
  PERFORM public._fisk_assert_tenant_access(p_restaurant_id);

  IF jsonb_typeof(p_groups) <> 'array' OR jsonb_array_length(p_groups) < 2 THEN
    RAISE EXCEPTION 'Split zahtijeva najmanje 2 grupe' USING ERRCODE = '22023';
  END IF;

  -- Izvor smije biti fakturisan samo jednom (original; storno se ne računa).
  IF EXISTS (SELECT 1 FROM invoices
              WHERE restaurant_id = p_restaurant_id AND source_type = p_source_type
                AND source_id = p_source_id AND corrective_for IS NULL) THEN
    RAISE EXCEPTION 'Izvor je već fakturisan (% %)', p_source_type, p_source_id USING ERRCODE = '22023';
  END IF;

  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    v_idx := v_idx + 1;
    RETURN NEXT create_invoice_from_items(
      p_restaurant_id, p_source_type, p_source_id,
      p_source_type || ':' || p_source_id::text || ':split' || v_idx::text,
      v_group, p_kind, NULL, p_enu_code, NULL, NULL, NULL, 'ME'
    );
  END LOOP;
END; $$;

COMMENT ON FUNCTION public.create_split_invoices IS
  'Razbije izvor na N računa (po jedan po grupi stavki), atomarno. Idempotentno po grupi (<izvor>:split<i>). Blokira ako je izvor već fakturisan.';

-- ── create_storno_invoice: korektivni račun (ogledalo, negativni iznosi) ─────
CREATE OR REPLACE FUNCTION public.create_storno_invoice(
  p_invoice_id uuid,
  p_reason     text DEFAULT NULL
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig     public.invoices;
  v_existing public.invoices;
  v_new      public.invoices;
  v_fmt      text;
  v_year     int := EXTRACT(year FROM now())::int;
  v_ordinal  int;
  v_number   text;
BEGIN
  SELECT * INTO v_orig FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Račun % ne postoji', p_invoice_id USING ERRCODE = '22023';
  END IF;
  PERFORM public._fisk_assert_tenant_access(v_orig.restaurant_id);

  IF v_orig.corrective_for IS NOT NULL THEN
    RAISE EXCEPTION 'Storno računa nije moguće stornirati' USING ERRCODE = '22023';
  END IF;

  -- Idempotencija: ako storno već postoji, vrati ga.
  SELECT * INTO v_existing FROM invoices WHERE corrective_for = p_invoice_id LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT numbering_format INTO v_fmt FROM tax_config WHERE country = 'ME';

  INSERT INTO invoice_counters (restaurant_id, enu_code, year, last_number)
  VALUES (v_orig.restaurant_id, v_orig.enu_code, v_year, 1)
  ON CONFLICT (restaurant_id, enu_code, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_ordinal;

  v_number := COALESCE(
    replace(replace(replace(v_fmt, '{ordinal}', v_ordinal::text), '{enu}', v_orig.enu_code), '{year}', v_year::text),
    v_ordinal::text || '/' || v_orig.enu_code || '/' || v_year::text);

  INSERT INTO invoices (
    restaurant_id, source_type, source_id, idempotency_key,
    enu_code, business_unit_code, operator_code, invoice_ordinal, invoice_number,
    issued_at, kind, buyer_tin, currency,
    total_cents, total_base_cents, total_vat_cents,
    fiscal_status, corrective_for, correction_reason
  ) VALUES (
    v_orig.restaurant_id, v_orig.source_type, v_orig.source_id, 'storno:' || p_invoice_id::text,
    v_orig.enu_code, v_orig.business_unit_code, v_orig.operator_code, v_ordinal, v_number,
    now(), 'CORRECTIVE', v_orig.buyer_tin, v_orig.currency,
    -v_orig.total_cents, -v_orig.total_base_cents, -v_orig.total_vat_cents,
    'PENDING', p_invoice_id, p_reason
  ) RETURNING * INTO v_new;

  -- Ogledalo stavki sa negativnim iznosima.
  INSERT INTO invoice_items (
    invoice_id, restaurant_id, name, quantity, unit_price_cents, vat_rate_key,
    base_cents, vat_cents, total_cents, sort_order)
  SELECT v_new.id, v_orig.restaurant_id, name, -quantity, unit_price_cents, vat_rate_key,
         -base_cents, -vat_cents, -total_cents, sort_order
  FROM invoice_items WHERE invoice_id = p_invoice_id;

  RETURN v_new;
END; $$;

COMMENT ON FUNCTION public.create_storno_invoice IS
  'Kreira korektivni (storno) račun: ogledalo originala sa negativnim iznosima, corrective_for=original. Idempotentno (storno:<id>). Original ostaje u evidenciji.';

REVOKE ALL ON FUNCTION public.get_invoice_source_items FROM public, anon;
REVOKE ALL ON FUNCTION public.create_split_invoices    FROM public, anon;
REVOKE ALL ON FUNCTION public.create_storno_invoice    FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_source_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_split_invoices    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_storno_invoice    TO authenticated;
