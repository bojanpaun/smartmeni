-- ============================================================================
-- PDV stopa po kategoriji (FISK) — categories.vat_rate_key kao DEFAULT za jela.
-- ----------------------------------------------------------------------------
-- Klasifikacija se radi jednom po kategoriji (Hrana=15%, Piće=21%), a jela
-- nasljeđuju. menu_items.vat_rate_key ostaje OVERRIDE za izuzetke. Efektivna
-- stopa = COALESCE(jelo.vat_rate_key, kategorija.vat_rate_key) → NULL = 0%.
-- ============================================================================

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS vat_rate_key text;
COMMENT ON COLUMN public.categories.vat_rate_key IS
  'FISK: podrazumijevana PDV stopa (tax_config.rates[].key) za jela ove kategorije. menu_items.vat_rate_key je override. NULL → 0%.';

-- Ažuriraj order reader: efektivna stopa = jelo → kategorija → NULL.
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
            'vat_rate_key',     COALESCE(mi.vat_rate_key, c.vat_rate_key)  -- jelo → kategorija
         )), '[]'::jsonb)
    INTO v_items
  FROM order_items oi
  LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
  LEFT JOIN categories c  ON c.id = mi.category_id
  WHERE oi.order_id = p_order_id;

  RETURN create_invoice_from_items(
    v_rest, 'order', p_order_id, 'order:' || p_order_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;
