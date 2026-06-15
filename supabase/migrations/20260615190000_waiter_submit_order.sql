-- ============================================================================
-- Faza WO (RPC) — waiter_submit_order: atomarni konobarski unos narudžbe
-- ----------------------------------------------------------------------------
-- Jedna funkcija kreira novu ILI dopunjava otvorenu narudžbu stola, postavlja
-- routing (kitchen/bar po categories.is_bar) i total, ubacuje stavke. Frontend
-- zove samo nju (CLAUDE.md: kompleksnu logiku držati u Postgres funkciji).
--
-- SECURITY INVOKER: radi kao prijavljeni konobar. Insert (orders/order_items) je
-- otvoren; UPDATE (append) prolazi preko staff-scoped politika iz Migracije B
-- (20260615180000). Članstvo se dodatno provjerava u funkciji (defense-in-depth).
--
-- p_mode: 'auto' = dopuni otvorenu narudžbu stola ako postoji, inače nova;
--         'new'  = uvijek nova zasebna; 'append' = zahtijeva otvorenu (greška ako nema).
-- Spec: docs/spec-konobarski-unos-narudzbe.md (v1.1).
-- ============================================================================

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
  -- Validacija članstva (uz RLS): aktivan staff ovog tenanta.
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

  -- Bar set + agregati po stavkama (kitchen/bar prisustvo, delta total).
  SELECT array_agg(id) INTO v_bar FROM public.categories
   WHERE restaurant_id = p_restaurant_id AND is_bar;

  SELECT bool_or(NOT x.is_bar), bool_or(x.is_bar), COALESCE(SUM(x.price * x.qty), 0)
    INTO v_kitchen, v_bar_has, v_delta
  FROM (
    SELECT COALESCE((e->>'category_id')::uuid = ANY(COALESCE(v_bar, '{}'::uuid[])), false) AS is_bar,
           (e->>'price')::numeric    AS price,
           (e->>'quantity')::int     AS qty
    FROM jsonb_array_elements(p_items) e
  ) x;

  -- Nađi otvorenu narudžbu stola (za auto/append).
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
    -- Dopuna: total se SABIRA (row-lock → concurrency-safe); ready/served → preparing;
    -- podigni stanične statuse za stanice koje nove stavke pogađaju.
    UPDATE public.orders SET
      total          = COALESCE(total, 0) + v_delta,
      status         = CASE WHEN status IN ('ready','served') THEN 'preparing' ELSE status END,
      kitchen_status = CASE WHEN v_kitchen THEN 'preparing' ELSE kitchen_status END,
      bar_status     = CASE WHEN v_bar_has THEN 'preparing' ELSE bar_status END,
      updated_at     = now()
    WHERE id = v_order.id RETURNING * INTO v_order;
  END IF;

  -- Stavke (cijena = snapshot u trenutku unosa, kao kod gosta).
  INSERT INTO public.order_items (restaurant_id, order_id, menu_item_id, name, price,
                                  quantity, category_id, note)
  SELECT p_restaurant_id, v_order.id, (e->>'menu_item_id')::uuid, e->>'name',
         (e->>'price')::numeric, (e->>'quantity')::int,
         (e->>'category_id')::uuid, NULLIF(e->>'note', '')
  FROM jsonb_array_elements(p_items) e;

  RETURN v_order;
END $$;

COMMENT ON FUNCTION public.waiter_submit_order(uuid, text, jsonb, text) IS
  'Konobarski unos narudžbe (StaffPortal). Kreira novu ili dopunjava otvorenu narudžbu '
  'stola, routing kitchen/bar po categories.is_bar, total = Σ price·qty. SECURITY INVOKER '
  '(radi kao staff; UPDATE prolazi preko staff RLS). Vraća orders red.';

GRANT EXECUTE ON FUNCTION public.waiter_submit_order(uuid, text, jsonb, text) TO authenticated;
