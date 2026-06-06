-- Import iz biblioteke: ciljna kategorija + popuna slike na postojećim stavkama
--
-- ZAŠTO (2 promjene):
--  1) Admin bira u koji TAB (kategoriju) idu stavke — ranije se uvijek pravio nov
--     "Kafa"/"Kokteli" tab. Sad RPC prima p_category_id; ako je dat (i pripada
--     restoranu) koristi se on, inače fallback na auto Kafa/Kokteli.
--  2) Re-import popunjava sliku na VEĆ uvezenoj stavci ako je ona bez slike
--     (image_url IS NULL). Ako je admin sam dodao sliku, NE diramo je.
--
-- Stara 2-arg verzija se briše (DEFAULT param bi inače stvorio overload ambiguity).

DROP FUNCTION IF EXISTS public.import_recipe_from_library(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.import_recipe_from_library(
  p_recipe_id     TEXT,
  p_restaurant_id UUID,
  p_category_id   UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec          public.recipe_library%ROWTYPE;
  v_rest         public.restaurants%ROWTYPE;
  v_has_inv      BOOLEAN;
  v_cat_name     TEXT;
  v_cat_icon     TEXT;
  v_category_id  UUID;
  v_existing     public.menu_items%ROWTYPE;
  v_menu_item_id UUID;
  v_menu_created BOOLEAN := false;
  v_inv_id       UUID;
  v_ing          RECORD;
  v_norm_plan    TEXT;
BEGIN
  -- 1) Autorizacija
  SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restoran ne postoji';
  END IF;
  IF NOT (v_rest.user_id = auth.uid() OR public.is_superadmin()) THEN
    RAISE EXCEPTION 'Nemate pravo na ovaj restoran';
  END IF;

  -- 2) Recept iz biblioteke
  SELECT * INTO v_rec FROM public.recipe_library
   WHERE id = p_recipe_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recept ne postoji ili nije aktivan: %', p_recipe_id;
  END IF;

  -- 3) Ima li tenant inventory_pro (mirror planUtils.hasAddon)
  v_norm_plan := CASE WHEN v_rest.plan = 'pro' THEN 'restaurant'
                      ELSE COALESCE(v_rest.plan, 'starter') END;
  v_has_inv := v_rest.is_complimentary
    OR v_norm_plan IN ('restaurant','hotel','hotel_pro','enterprise')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.restaurant_id = p_restaurant_id
         AND (
           (CASE WHEN s.plan = 'pro' THEN 'restaurant'
                 ELSE COALESCE(s.plan,'starter') END)
             IN ('restaurant','hotel','hotel_pro','enterprise')
           OR s.addons ? 'inventory_pro'
         )
    );

  -- 4) Ciljna kategorija: koristi zadatu ako pripada restoranu, inače auto.
  IF p_category_id IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.categories
     WHERE id = p_category_id AND restaurant_id = p_restaurant_id;
  END IF;

  IF v_category_id IS NULL THEN
    IF v_rec.category = 'coffee' THEN
      v_cat_name := 'Kafa';    v_cat_icon := '☕';
    ELSIF v_rec.category = 'cocktail' THEN
      v_cat_name := 'Kokteli'; v_cat_icon := '🍸';
    ELSE
      v_cat_name := 'Piće';    v_cat_icon := '🍹';
    END IF;

    SELECT id INTO v_category_id FROM public.categories
     WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_cat_name)
     LIMIT 1;
    IF v_category_id IS NULL THEN
      INSERT INTO public.categories (restaurant_id, name, icon, is_bar, sort_order)
      VALUES (p_restaurant_id, v_cat_name, v_cat_icon, true,
              COALESCE((SELECT max(sort_order)+1 FROM public.categories
                        WHERE restaurant_id = p_restaurant_id), 0))
      RETURNING id INTO v_category_id;
    END IF;
  END IF;

  -- 5) Menu item (find-or-create po nazivu)
  SELECT * INTO v_existing FROM public.menu_items
   WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_rec.name)
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    v_menu_item_id := v_existing.id;
    -- Popuni sliku samo ako je postojeća stavka bez slike (ne gazimo admin sliku).
    IF (v_existing.image_url IS NULL OR v_existing.image_url = '')
       AND v_rec.image_url IS NOT NULL THEN
      UPDATE public.menu_items SET image_url = v_rec.image_url WHERE id = v_menu_item_id;
    END IF;
  ELSE
    INSERT INTO public.menu_items
      (restaurant_id, category_id, name, name_en, description, price, emoji, image_url, is_visible, sort_order)
    VALUES
      (p_restaurant_id, v_category_id, v_rec.name, v_rec.name_en, v_rec.instructions,
       COALESCE(v_rec.suggested_price, 0), COALESCE(v_rec.emoji, '🍽️'), v_rec.image_url, true,
       COALESCE((SELECT max(sort_order)+1 FROM public.menu_items
                 WHERE restaurant_id = p_restaurant_id), 0))
    RETURNING id INTO v_menu_item_id;
    v_menu_created := true;
  END IF;

  -- 6) Recept / BOM — samo uz inventory_pro
  IF v_has_inv THEN
    FOR v_ing IN
      SELECT * FROM public.recipe_library_ingredients
       WHERE recipe_id = p_recipe_id ORDER BY sort_order
    LOOP
      SELECT id INTO v_inv_id FROM public.inventory_items
       WHERE restaurant_id = p_restaurant_id
         AND lower(name) = lower(v_ing.ingredient_name)
         AND unit = v_ing.unit
       LIMIT 1;
      IF v_inv_id IS NULL THEN
        INSERT INTO public.inventory_items (restaurant_id, name, unit, quantity, category)
        VALUES (p_restaurant_id, v_ing.ingredient_name, v_ing.unit, 0, 'piće')
        RETURNING id INTO v_inv_id;
      END IF;

      INSERT INTO public.menu_item_ingredients (menu_item_id, inventory_item_id, quantity)
      VALUES (v_menu_item_id, v_inv_id, v_ing.quantity)
      ON CONFLICT (menu_item_id, inventory_item_id)
      DO UPDATE SET quantity = EXCLUDED.quantity;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'menu_item_id',    v_menu_item_id,
    'menu_created',    v_menu_created,
    'recipe_imported', v_has_inv,
    'category_id',     v_category_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_recipe_from_library(TEXT, UUID, UUID) TO authenticated;
