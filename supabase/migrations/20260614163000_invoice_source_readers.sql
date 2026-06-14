-- ============================================================================
-- FISK-2c-readeri — po-izvor assembly: čitaju order/folio/spa, grade `items` niz
-- i zovu create_invoice_from_items (jedan autoritativni put za numeraciju/PDV).
-- ----------------------------------------------------------------------------
-- Idempotency_key je deterministički po izvoru ('order:<id>' itd.) → retry/dupli
-- okidač NE pravi drugi račun. vat_rate_key se NE izvodi iz kategorije ovdje
-- (app ne klasifikuje, Princip Granice): čita se sa artikla; NULL → 0% dok tenant
-- ne klasifikuje. Cijene su numeric(10,2) → centi = round(×100) (regionalne valute
-- su 2-decimalne; currency.decimals refaktor po potrebi kasnije). Država 'ME'
-- (jedini tax_config zasad; parametrizovati kad bude tenant_fiscal_configs.country).
-- ============================================================================

-- ── order → račun ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invoice_from_order(
  p_order_id uuid,
  p_enu_code text DEFAULT 'DEFAULT',
  p_kind     text DEFAULT 'CASH_B2C',
  p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rest  uuid;
  v_items jsonb;
BEGIN
  SELECT restaurant_id INTO v_rest FROM orders WHERE id = p_order_id;
  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Narudžba % ne postoji', p_order_id USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name',             oi.name,
            'quantity',         COALESCE(oi.quantity, 1),
            'unit_price_cents', round(oi.price * 100)::int,
            'vat_rate_key',     mi.vat_rate_key
         )), '[]'::jsonb)
    INTO v_items
  FROM order_items oi
  LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = p_order_id;

  RETURN create_invoice_from_items(
    v_rest, 'order', p_order_id, 'order:' || p_order_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;

-- ── spa termin → račun ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invoice_from_spa(
  p_appointment_id uuid,
  p_enu_code text DEFAULT 'DEFAULT',
  p_kind     text DEFAULT 'CASH_B2C',
  p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rest  uuid;
  v_items jsonb;
BEGIN
  SELECT a.restaurant_id,
         jsonb_build_array(jsonb_build_object(
           'name',             s.name,
           'quantity',         1,
           'unit_price_cents', round(a.price * 100)::int,
           'vat_rate_key',     s.vat_rate_key
         ))
    INTO v_rest, v_items
  FROM spa_appointments a
  JOIN spa_services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Spa termin % ne postoji', p_appointment_id USING ERRCODE = '22023';
  END IF;

  RETURN create_invoice_from_items(
    v_rest, 'spa', p_appointment_id, 'spa:' || p_appointment_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;

-- ── folio → račun ───────────────────────────────────────────────────────────
-- folio_items nemaju vat_rate_key (agregat soba/restoran/minibar/spa); NULL → 0%
-- dok se ne riješi mapiranje type→stopa (folio-račun, FISK-5). unit_price može biti
-- NULL → izvedi iz total_price/quantity.
CREATE OR REPLACE FUNCTION public.create_invoice_from_folio(
  p_folio_id uuid,
  p_enu_code text DEFAULT 'DEFAULT',
  p_kind     text DEFAULT 'CASH_B2C',
  p_payment_transaction_id uuid DEFAULT NULL
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rest  uuid;
  v_items jsonb;
BEGIN
  SELECT restaurant_id INTO v_rest FROM folios WHERE id = p_folio_id;
  IF v_rest IS NULL THEN
    RAISE EXCEPTION 'Folio % ne postoji', p_folio_id USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name',             fi.description,
            'quantity',         COALESCE(fi.quantity, 1),
            'unit_price_cents', round(COALESCE(fi.unit_price, fi.total_price / NULLIF(fi.quantity, 0)) * 100)::int,
            'vat_rate_key',     NULL
         )), '[]'::jsonb)
    INTO v_items
  FROM folio_items fi
  WHERE fi.folio_id = p_folio_id;

  RETURN create_invoice_from_items(
    v_rest, 'folio', p_folio_id, 'folio:' || p_folio_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;

COMMENT ON FUNCTION public.create_invoice_from_order  IS 'FISK-2c: assembly iz narudžbe (order_items + menu_items.vat_rate_key) → create_invoice_from_items. Idempotentno (order:<id>).';
COMMENT ON FUNCTION public.create_invoice_from_spa    IS 'FISK-2c: assembly iz spa termina (spa_services.vat_rate_key) → create_invoice_from_items. Idempotentno (spa:<id>).';
COMMENT ON FUNCTION public.create_invoice_from_folio  IS 'FISK-2c: assembly iz folija (folio_items; vat_rate_key NULL dok type→stopa nije riješeno, FISK-5) → create_invoice_from_items. Idempotentno (folio:<id>).';

REVOKE ALL ON FUNCTION public.create_invoice_from_order  FROM public, anon;
REVOKE ALL ON FUNCTION public.create_invoice_from_spa    FROM public, anon;
REVOKE ALL ON FUNCTION public.create_invoice_from_folio  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_order  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_spa    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_folio  TO authenticated;
