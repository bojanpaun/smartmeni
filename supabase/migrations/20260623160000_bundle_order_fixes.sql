-- ============================================================================
-- Faza 4 — popravke: (1) popust na KRAJU paketa na računu, (3) konobarski unos paketa.
-- ----------------------------------------------------------------------------
-- (1) create_invoice_from_order: deterministički redoslijed stavki — normalni artikli,
--     pa po paketu [komponente, pa stavka popusta]. (created_at je isti u batch-u, id
--     je random → bez ORDER BY popust bi "plutao".)
-- (3) waiter_submit_order: prenosi bundle_id/is_bundle_component/vat_rate_key (paket iz
--     StaffPortala). Routing kitchen/bar SAMO po stvarnim artiklima (menu_item_id IS NOT
--     NULL) — stavka popusta (NULL) se ne računa; total = Σ(price·qty) (popust negativan).
-- ============================================================================

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
            'vat_rate_key',     COALESCE(oi.vat_rate_key, mi.vat_rate_key, c.vat_rate_key, mb.vat_rate_key)
         ) ORDER BY (oi.bundle_id IS NOT NULL), oi.bundle_id, (NOT oi.is_bundle_component), oi.created_at, oi.id), '[]'::jsonb)
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

-- ── waiter_submit_order: podrška paketima (bundle_id/komponenta/PDV) ──────────
CREATE OR REPLACE FUNCTION public.waiter_submit_order(
  p_restaurant_id uuid,
  p_table         text,
  p_items         jsonb,
  p_mode          text DEFAULT 'auto'
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_staff   uuid;
  v_order   public.orders;
  v_bar     uuid[];
  v_kitchen boolean;
  v_bar_has boolean;
  v_delta   numeric(10,2);
BEGIN
  SELECT id INTO v_staff FROM public.staff
   WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active
   LIMIT 1;
  IF v_staff IS NULL THEN RAISE EXCEPTION 'not_active_staff'; END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_items';
  END IF;
  IF p_mode NOT IN ('auto','new','append') THEN
    RAISE EXCEPTION 'bad_mode';
  END IF;

  SELECT array_agg(id) INTO v_bar FROM public.categories
   WHERE restaurant_id = p_restaurant_id AND is_bar;

  -- Routing preskače SAMO stavku popusta paketa (bundle_id set + menu_item_id NULL);
  -- obični artikli (uklj. slobodan unos bez menu_item_id) se i dalje routiraju.
  -- total uključuje sve (stavka popusta je negativna → Σ = cijena paketa).
  SELECT bool_or(NOT x.is_bar) FILTER (WHERE NOT x.is_discount),
         bool_or(x.is_bar)     FILTER (WHERE NOT x.is_discount),
         COALESCE(SUM(x.price * x.qty), 0)
    INTO v_kitchen, v_bar_has, v_delta
  FROM (
    SELECT COALESCE((e->>'category_id')::uuid = ANY(COALESCE(v_bar, '{}'::uuid[])), false) AS is_bar,
           (e->>'price')::numeric    AS price,
           (e->>'quantity')::int     AS qty,
           (NULLIF(e->>'bundle_id', '') IS NOT NULL AND NULLIF(e->>'menu_item_id', '') IS NULL) AS is_discount
    FROM jsonb_array_elements(p_items) e
  ) x;

  IF p_mode IN ('auto','append') THEN
    SELECT * INTO v_order FROM public.orders
     WHERE restaurant_id = p_restaurant_id AND table_number = p_table AND status <> 'closed'
     ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    IF p_mode = 'append' THEN RAISE EXCEPTION 'no_open_order'; END IF;
    INSERT INTO public.orders (restaurant_id, table_number, status, total, source,
                               created_by_staff_id, kitchen_status, bar_status)
    VALUES (p_restaurant_id, p_table, 'preparing', v_delta, 'waiter', v_staff,
            CASE WHEN v_kitchen THEN 'preparing' END,
            CASE WHEN v_bar_has THEN 'preparing' END)
    RETURNING * INTO v_order;
  ELSE
    UPDATE public.orders SET
      total          = COALESCE(total, 0) + v_delta,
      status         = CASE WHEN status IN ('ready','served') THEN 'preparing' ELSE status END,
      kitchen_status = CASE WHEN v_kitchen THEN 'preparing' ELSE kitchen_status END,
      bar_status     = CASE WHEN v_bar_has THEN 'preparing' ELSE bar_status END,
      updated_at     = now()
    WHERE id = v_order.id RETURNING * INTO v_order;
  END IF;

  INSERT INTO public.order_items (restaurant_id, order_id, menu_item_id, name, price,
                                  quantity, category_id, note, bundle_id, is_bundle_component, vat_rate_key)
  SELECT p_restaurant_id, v_order.id, NULLIF(e->>'menu_item_id','')::uuid, e->>'name',
         (e->>'price')::numeric, (e->>'quantity')::int,
         NULLIF(e->>'category_id','')::uuid, NULLIF(e->>'note', ''),
         NULLIF(e->>'bundle_id','')::uuid, COALESCE((e->>'is_bundle_component')::boolean, false),
         NULLIF(e->>'vat_rate_key','')
  FROM jsonb_array_elements(p_items) e;

  RETURN v_order;
END $$;

GRANT EXECUTE ON FUNCTION public.waiter_submit_order(uuid, text, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.create_invoice_from_order IS
  'FISK-2c + Faza 4: assembly iz narudžbe (komponente paketa po punoj cijeni + negativne stavke popusta po PDV grupi; popust na kraju paketa). Idempotentno (order:<id>).';
COMMENT ON FUNCTION public.waiter_submit_order(uuid, text, jsonb, text) IS
  'Konobarski unos (StaffPortal) + paketi: prenosi bundle_id/is_bundle_component/vat_rate_key. Routing kitchen/bar samo po artiklima; total = Σ price·qty (popust negativan). SECURITY INVOKER.';
