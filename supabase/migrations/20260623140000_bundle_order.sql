-- ============================================================================
-- FAZA 4: naručivanje paketa (bundle) — veza order_items ↔ menu_bundles
-- ----------------------------------------------------------------------------
-- Model "header + komponente" (dogovoreno):
--   • HEADER red: naziv+cijena paketa, menu_item_id NULL, bundle_id=paket,
--     is_bundle_component=false → NOSI naplatu (ulazi u total i račun).
--   • KOMPONENTE: po artiklu iz paketa, menu_item_id+category_id postavljeni,
--     price=0, bundle_id=paket, is_bundle_component=true → informativne za
--     kuhinju/bar (šta spremiti). NE ulaze u račun (izbjegava 0€ stavke).
-- menu_bundles.vat_rate_key = opciona PDV stopa paketa (NULL → 0%, ista politika
--   kao menu_items; FISK fallback "dok tenant ne klasifikuje").
-- ============================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES public.menu_bundles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_bundle_component boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_items_bundle ON public.order_items (bundle_id);

ALTER TABLE public.menu_bundles
  ADD COLUMN IF NOT EXISTS vat_rate_key text;

-- Reader narudžbe: izostavi komponente paketa iz računa; PDV header reda paketa
-- dolazi sa menu_bundles.vat_rate_key (menu_item_id je NULL kod headera).
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

  -- Efektivna stopa: jelo → kategorija → paket → NULL (0%). Komponente paketa izostavljene.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name',             oi.name,
            'quantity',         COALESCE(oi.quantity, 1),
            'unit_price_cents', round(oi.price * 100)::int,
            'vat_rate_key',     COALESCE(mi.vat_rate_key, c.vat_rate_key, mb.vat_rate_key)
         )), '[]'::jsonb)
    INTO v_items
  FROM order_items oi
  LEFT JOIN menu_items   mi ON mi.id = oi.menu_item_id
  LEFT JOIN categories   c  ON c.id  = mi.category_id
  LEFT JOIN menu_bundles mb ON mb.id = oi.bundle_id
  WHERE oi.order_id = p_order_id
    AND oi.is_bundle_component IS NOT TRUE;  -- komponente paketa se ne fakturišu (0€, info za kuhinju)

  RETURN create_invoice_from_items(
    v_rest, 'order', p_order_id, 'order:' || p_order_id::text,
    v_items, p_kind, NULL, p_enu_code, NULL, NULL, p_payment_transaction_id, 'ME'
  );
END;
$$;

COMMENT ON FUNCTION public.create_invoice_from_order IS
  'FISK-2c + Faza 4: assembly iz narudžbe (order_items + menu_items/menu_bundles vat_rate_key) → create_invoice_from_items. Komponente paketa (is_bundle_component) se izostavljaju (header nosi cijenu). Idempotentno (order:<id>).';
