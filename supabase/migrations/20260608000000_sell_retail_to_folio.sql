-- ============================================================================
-- sell_retail_to_folio — prodaja spa retail proizvoda na hotelski folio
-- ----------------------------------------------------------------------------
-- Atomično: kreira folio stavku (type 'spa') i skida zalihu proizvoda. Sprječava
-- prodaju iznad zaliha i cross-tenant. SECURITY DEFINER uz provjeru pristupa
-- (vlasnik/aktivni staff/superadmin).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sell_retail_to_folio(
  p_item_id UUID, p_folio_id UUID, p_quantity INT DEFAULT 1
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item  RECORD;
  v_folio RECORD;
  v_total NUMERIC(10,2);
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Količina mora biti veća od 0'; END IF;

  SELECT * INTO v_item FROM public.spa_retail_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proizvod ne postoji'; END IF;

  SELECT * INTO v_folio FROM public.folios WHERE id = p_folio_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Folio ne postoji'; END IF;

  IF v_item.restaurant_id <> v_folio.restaurant_id THEN
    RAISE EXCEPTION 'Proizvod i folio nisu iz istog restorana';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_item.restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff WHERE restaurant_id = v_item.restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  IF COALESCE(v_item.stock_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Nedovoljno zaliha';
  END IF;

  v_total := v_item.price * p_quantity;

  INSERT INTO public.folio_items (folio_id, restaurant_id, type, description, quantity, unit_price, total_price, date, created_by)
  VALUES (
    p_folio_id, v_item.restaurant_id, 'spa',
    v_item.name || COALESCE(' (' || v_item.brand || ')', ''),
    p_quantity, v_item.price, v_total, current_date,
    -- created_by samo ako profil postoji (FK na user_profiles; kolona nullable)
    (SELECT id FROM public.user_profiles WHERE id = auth.uid())
  );

  UPDATE public.spa_retail_items SET stock_quantity = stock_quantity - p_quantity WHERE id = p_item_id;

  RETURN jsonb_build_object('ok', true, 'total', v_total);
END; $$;

GRANT EXECUTE ON FUNCTION public.sell_retail_to_folio(UUID, UUID, INT) TO authenticated;

COMMENT ON FUNCTION public.sell_retail_to_folio(UUID, UUID, INT) IS
  'Prodaja spa retail proizvoda na folio: folio stavka + skidanje zaliha, atomično, uz provjeru zaliha i pristupa.';
