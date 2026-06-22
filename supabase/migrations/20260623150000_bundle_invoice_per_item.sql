-- ============================================================================
-- FAZA 4b: paket na fiskalnom računu PO ARTIKLIMA + vidljiv popust.
-- ----------------------------------------------------------------------------
-- Promjena modela naplate paketa (na zahtjev): umjesto jednog "header" reda,
-- paket se na računu prikazuje kao:
--   • KOMPONENTE po PUNOJ cijeni (svaka sa svojom PDV stopom), +
--   • zasebna stavka "Popust: <paket> (−X%)" po PDV grupi (negativan iznos).
-- Zbir = bundle_price (egzaktno; alokacija popusta po grupi se radi pri kreiranju
-- narudžbe — menuHelpers.allocateBundleDiscount).
--
-- order_items.vat_rate_key: stavka popusta nema menu_item_id, pa nosi svoju PDV
-- grupu eksplicitno. Reader je COALESCE(oi.vat_rate_key, jelo, kategorija, paket).
-- Reader VIŠE NE izostavlja komponente (sve stavke ulaze; popust je negativan red).
-- ============================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS vat_rate_key text;

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

  -- Sve stavke (komponente paketa po punoj cijeni + negativne stavke popusta).
  -- Efektivna PDV stopa: eksplicitna na stavci (popust) → jelo → kategorija → paket → 0%.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name',             oi.name,
            'quantity',         COALESCE(oi.quantity, 1),
            'unit_price_cents', round(oi.price * 100)::int,
            'vat_rate_key',     COALESCE(oi.vat_rate_key, mi.vat_rate_key, c.vat_rate_key, mb.vat_rate_key)
         ) ORDER BY oi.created_at, oi.id), '[]'::jsonb)
    INTO v_items
  FROM order_items oi
  LEFT JOIN menu_items   mi ON mi.id = oi.menu_item_id
  LEFT JOIN categories   c  ON c.id  = mi.category_id
  LEFT JOIN menu_bundles mb ON mb.id = oi.bundle_id
  WHERE oi.order_id = p_order_id;

  RETURN create_invoice_from_items(
    v_rest, 'order', p_order_id, 'order:' || p_order_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;

COMMENT ON FUNCTION public.create_invoice_from_order IS
  'FISK-2c + Faza 4b: assembly iz narudžbe. Paket = komponente po punoj cijeni + negativne stavke popusta (po PDV grupi). PDV: COALESCE(order_items.vat_rate_key, jelo, kategorija, paket). Idempotentno (order:<id>).';
