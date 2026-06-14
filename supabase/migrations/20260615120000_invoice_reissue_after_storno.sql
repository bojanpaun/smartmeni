-- ============================================================================
-- FISK — ponovno izdavanje/razdvajanje nakon storna.
-- ----------------------------------------------------------------------------
-- Do sada: čim je izvor imao BILO KOJI račun, smatran je fakturisanim (nestao iz
-- „Za izdavanje", split blokiran) — pa već izdat račun nije bilo moguće razdvojiti.
-- Sada: izvor je „fakturisan" samo ako ima AKTIVAN (nestorniran) original. Storno
-- svih aktivnih originala oslobađa izvor → ponovo se može izdati JEDAN ili RAZDVOJITI.
-- Ključevi idempotencije su generacijski (`:r<gen>`) da se preko generacija ne sudaraju.
-- ============================================================================

-- Aktivan original = račun bez corrective_for koji NEMA storno koji ga poništava.
CREATE OR REPLACE FUNCTION public._fisk_active_invoice_exists(
  p_restaurant_id uuid, p_source_type text, p_source_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.restaurant_id = p_restaurant_id AND i.source_type = p_source_type AND i.source_id = p_source_id
      AND i.corrective_for IS NULL
      AND NOT EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for = i.id)
  );
$$;

-- Generacija = broj storniranih originala za izvor (raste pri svakom storniranju);
-- koristi se kao sufiks ključa idempotencije da ponovno izdavanje ne pogodi stari račun.
CREATE OR REPLACE FUNCTION public._fisk_invoice_generation(
  p_restaurant_id uuid, p_source_type text, p_source_id uuid
) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM invoices i
  WHERE i.restaurant_id = p_restaurant_id AND i.source_type = p_source_type AND i.source_id = p_source_id
    AND i.corrective_for IS NULL
    AND EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for = i.id);
$$;

-- ── get_unbilled_sources: izvor je nedovršen ako NEMA aktivnog originala ──────
CREATE OR REPLACE FUNCTION public.get_unbilled_sources(
  p_restaurant_id uuid, p_limit int DEFAULT 50
) RETURNS TABLE (source_type text, source_id uuid, ref_label text, occurred_at timestamptz, total_amount numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = p_restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff s WHERE s.restaurant_id = p_restaurant_id AND s.user_id = auth.uid() AND s.is_active)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT q.source_type, q.source_id, q.ref_label, q.occurred_at, q.total_amount
  FROM (
    SELECT 'order'::text AS source_type, o.id AS source_id,
           ('Sto ' || COALESCE(o.table_number, '-'))::text AS ref_label,
           o.created_at AS occurred_at, COALESCE(o.total, 0)::numeric AS total_amount
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id AND o.status IN ('served', 'closed') AND o.rejection_message IS NULL
      AND NOT public._fisk_active_invoice_exists(p_restaurant_id, 'order', o.id)

    UNION ALL
    SELECT 'spa'::text, a.id, COALESCE(s.name, 'Spa')::text,
           (a.appointment_date + a.start_time)::timestamptz, COALESCE(a.price, 0)::numeric
    FROM spa_appointments a
    LEFT JOIN spa_services s ON s.id = a.service_id
    WHERE a.restaurant_id = p_restaurant_id AND a.status NOT IN ('cancelled', 'no_show')
      AND NOT public._fisk_active_invoice_exists(p_restaurant_id, 'spa', a.id)

    UNION ALL
    SELECT 'folio'::text, f.id,
           ('Folio ' || COALESCE(NULLIF(trim(coalesce(g.first_name,'') || ' ' || coalesce(g.last_name,'')), ''), '—'))::text,
           f.created_at, COALESCE(f.total_amount, 0)::numeric
    FROM folios f
    LEFT JOIN guests g ON g.id = f.guest_id
    WHERE f.restaurant_id = p_restaurant_id AND COALESCE(f.total_amount, 0) > 0
      AND NOT public._fisk_active_invoice_exists(p_restaurant_id, 'folio', f.id)
  ) q
  ORDER BY q.occurred_at DESC
  LIMIT p_limit;
END; $$;

-- ── Readeri: ako postoji aktivan original → vrati ga; inače gen-aware ključ ───
CREATE OR REPLACE FUNCTION public.create_invoice_from_order(
  p_order_id uuid, p_enu_code text DEFAULT 'DEFAULT', p_kind text DEFAULT 'CASH_B2C', p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid; v_items jsonb; v_active public.invoices; v_gen int; v_key text;
BEGIN
  SELECT restaurant_id INTO v_rest FROM orders WHERE id = p_order_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'Narudžba % ne postoji', p_order_id USING ERRCODE = '22023'; END IF;

  SELECT i.* INTO v_active FROM invoices i
   WHERE i.restaurant_id = v_rest AND i.source_type = 'order' AND i.source_id = p_order_id
     AND i.corrective_for IS NULL AND NOT EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for = i.id)
   ORDER BY i.issued_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_active; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name', oi.name, 'quantity', COALESCE(oi.quantity, 1),
            'unit_price_cents', round(oi.price * 100)::int,
            'vat_rate_key', COALESCE(mi.vat_rate_key, c.vat_rate_key))), '[]'::jsonb)
    INTO v_items
  FROM order_items oi
  LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
  LEFT JOIN categories  c  ON c.id = mi.category_id
  WHERE oi.order_id = p_order_id;

  v_gen := public._fisk_invoice_generation(v_rest, 'order', p_order_id);
  v_key := 'order:' || p_order_id::text || CASE WHEN v_gen > 0 THEN ':r' || v_gen::text ELSE '' END;
  RETURN create_invoice_from_items(v_rest, 'order', p_order_id, v_key, v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME');
END; $$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_spa(
  p_appointment_id uuid, p_enu_code text DEFAULT 'DEFAULT', p_kind text DEFAULT 'CASH_B2C', p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid; v_items jsonb; v_active public.invoices; v_gen int; v_key text;
BEGIN
  SELECT a.restaurant_id,
         jsonb_build_array(jsonb_build_object('name', s.name, 'quantity', 1,
           'unit_price_cents', round(a.price * 100)::int, 'vat_rate_key', s.vat_rate_key))
    INTO v_rest, v_items
  FROM spa_appointments a JOIN spa_services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'Spa termin % ne postoji', p_appointment_id USING ERRCODE = '22023'; END IF;

  SELECT i.* INTO v_active FROM invoices i
   WHERE i.restaurant_id = v_rest AND i.source_type = 'spa' AND i.source_id = p_appointment_id
     AND i.corrective_for IS NULL AND NOT EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for = i.id)
   ORDER BY i.issued_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_active; END IF;

  v_gen := public._fisk_invoice_generation(v_rest, 'spa', p_appointment_id);
  v_key := 'spa:' || p_appointment_id::text || CASE WHEN v_gen > 0 THEN ':r' || v_gen::text ELSE '' END;
  RETURN create_invoice_from_items(v_rest, 'spa', p_appointment_id, v_key, v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME');
END; $$;

CREATE OR REPLACE FUNCTION public.create_invoice_from_folio(
  p_folio_id uuid, p_enu_code text DEFAULT 'DEFAULT', p_kind text DEFAULT 'CASH_B2C', p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rest uuid; v_items jsonb; v_active public.invoices; v_gen int; v_key text;
BEGIN
  SELECT restaurant_id INTO v_rest FROM folios WHERE id = p_folio_id;
  IF v_rest IS NULL THEN RAISE EXCEPTION 'Folio % ne postoji', p_folio_id USING ERRCODE = '22023'; END IF;

  SELECT i.* INTO v_active FROM invoices i
   WHERE i.restaurant_id = v_rest AND i.source_type = 'folio' AND i.source_id = p_folio_id
     AND i.corrective_for IS NULL AND NOT EXISTS (SELECT 1 FROM invoices st WHERE st.corrective_for = i.id)
   ORDER BY i.issued_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_active; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name', fi.description, 'quantity', COALESCE(fi.quantity, 1),
            'unit_price_cents', round(COALESCE(fi.unit_price, fi.total_price / NULLIF(fi.quantity, 0)) * 100)::int,
            'vat_rate_key', NULL)), '[]'::jsonb)
    INTO v_items
  FROM folio_items fi WHERE fi.folio_id = p_folio_id;

  v_gen := public._fisk_invoice_generation(v_rest, 'folio', p_folio_id);
  v_key := 'folio:' || p_folio_id::text || CASE WHEN v_gen > 0 THEN ':r' || v_gen::text ELSE '' END;
  RETURN create_invoice_from_items(v_rest, 'folio', p_folio_id, v_key, v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME');
END; $$;

-- ── create_split_invoices: blokira samo ako postoji AKTIVAN original; gen ključ ─
CREATE OR REPLACE FUNCTION public.create_split_invoices(
  p_restaurant_id uuid, p_source_type text, p_source_id uuid, p_groups jsonb,
  p_enu_code text DEFAULT 'DEFAULT', p_kind text DEFAULT 'CASH_B2C'
) RETURNS SETOF public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_group jsonb; v_idx int := 0; v_gen int; v_base text;
BEGIN
  PERFORM public._fisk_assert_tenant_access(p_restaurant_id);

  IF jsonb_typeof(p_groups) <> 'array' OR jsonb_array_length(p_groups) < 2 THEN
    RAISE EXCEPTION 'Split zahtijeva najmanje 2 grupe' USING ERRCODE = '22023';
  END IF;

  IF public._fisk_active_invoice_exists(p_restaurant_id, p_source_type, p_source_id) THEN
    RAISE EXCEPTION 'Izvor već ima aktivan račun — storniraj ga prije razdvajanja (% %)', p_source_type, p_source_id USING ERRCODE = '22023';
  END IF;

  v_gen := public._fisk_invoice_generation(p_restaurant_id, p_source_type, p_source_id);
  v_base := p_source_type || ':' || p_source_id::text || CASE WHEN v_gen > 0 THEN ':r' || v_gen::text ELSE '' END;

  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    v_idx := v_idx + 1;
    RETURN NEXT create_invoice_from_items(
      p_restaurant_id, p_source_type, p_source_id, v_base || ':split' || v_idx::text,
      v_group, p_kind, NULL, p_enu_code, NULL, NULL, NULL, 'ME');
  END LOOP;
END; $$;

COMMENT ON FUNCTION public.create_split_invoices IS
  'Razbije izvor na N računa, atomarno. Blokira ako postoji AKTIVAN (nestorniran) original — za već izdat račun prvo storno. Gen-aware ključevi.';
