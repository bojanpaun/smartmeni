-- Biblioteka preddefinisanih recepata (kafa, kokteli, ...) — globalni katalog
--
-- ZAŠTO: ubrzava postavljanje menija. Tenant na /admin/menu klikom "Preuzmi"
-- materijalizuje stavku menija (+ inventar + recept ako ima inventory_pro) iz
-- dijeljenog kataloga. Katalog je referentni, dijeljen za sve tenante — po istom
-- principu kao addon_catalog NEMA restaurant_id (svjesna iznimka od tenant pravila).

-- ─── KATALOG TABELE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipe_library (
  id              TEXT PRIMARY KEY,           -- slug, npr. 'mojito', 'cappuccino'
  name            TEXT NOT NULL,              -- naziv (crnogorski) — ide u menu_items.name
  name_en         TEXT,                       -- menu_items.name_en (javni meni /en)
  category        TEXT NOT NULL,              -- 'coffee' | 'cocktail' | ...
  emoji           TEXT DEFAULT '🍽️',
  suggested_price NUMERIC(10,2),              -- predlog cijene; tenant doradi
  instructions    TEXT,                       -- kratka priprema (opciono → description)
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_library_ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       TEXT NOT NULL REFERENCES public.recipe_library(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,              -- naziv namirnice (→ inventory_items.name)
  quantity        NUMERIC(10,3) NOT NULL,     -- količina po porciji
  unit            TEXT NOT NULL DEFAULT 'kom',-- 'ml' | 'g' | 'kom'
  sort_order      INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS recipe_library_ingredients_recipe_idx
  ON public.recipe_library_ingredients(recipe_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.recipe_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_library_ingredients ENABLE ROW LEVEL SECURITY;

-- Svi autentifikovani čitaju aktivan katalog
CREATE POLICY "Authenticated reads recipe library"
  ON public.recipe_library FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Authenticated reads recipe library ingredients"
  ON public.recipe_library_ingredients FOR SELECT TO authenticated
  USING (true);

-- Superadmin upravlja katalogom (koristi is_superadmin() helper — vidi 20260606000002)
CREATE POLICY "Superadmin manages recipe library"
  ON public.recipe_library FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin manages recipe library ingredients"
  ON public.recipe_library_ingredients FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ─── IMPORT RPC ───────────────────────────────────────────────────────────────
-- Atomično preuzimanje jednog recepta u tenanta:
--   1) nađi-ili-kreiraj ciljnu (bar) kategoriju
--   2) nađi-ili-kreiraj menu_item (po nazivu)
--   3) ako tenant ima inventory_pro → nađi-ili-kreiraj namirnice + upiši BOM
-- SECURITY DEFINER (zaobilazi RLS), ali RUČNO provjerava da je pozivalac vlasnik
-- restorana ili superadmin. inventory_pro se provjerava server-side (mirror planUtils).
CREATE OR REPLACE FUNCTION public.import_recipe_from_library(
  p_recipe_id     TEXT,
  p_restaurant_id UUID
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

  -- 4) Ciljna (bar) kategorija
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

  -- 5) Menu item (find-or-create po nazivu)
  SELECT id INTO v_menu_item_id FROM public.menu_items
   WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_rec.name)
   LIMIT 1;
  IF v_menu_item_id IS NULL THEN
    INSERT INTO public.menu_items
      (restaurant_id, category_id, name, name_en, description, price, emoji, is_visible, sort_order)
    VALUES
      (p_restaurant_id, v_category_id, v_rec.name, v_rec.name_en, v_rec.instructions,
       COALESCE(v_rec.suggested_price, 0), COALESCE(v_rec.emoji, '🍽️'), true,
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

GRANT EXECUTE ON FUNCTION public.import_recipe_from_library(TEXT, UUID) TO authenticated;
