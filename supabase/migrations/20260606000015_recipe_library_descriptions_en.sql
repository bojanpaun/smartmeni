-- Engleski opisi za biblioteku (menu_items.description_en)
--
-- recipe_library dobija description_en; RPC ga kopira pri kreiranju i popunjava
-- na već uvezenim stavkama bez EN opisa (admin tekst se ne gazi).

ALTER TABLE public.recipe_library ADD COLUMN IF NOT EXISTS description_en TEXT;

UPDATE public.recipe_library r SET description_en = v.descr
FROM (VALUES
  -- Coffee
  ('espresso','Classic Italian espresso — concentrated and aromatic.'),
  ('doppio','Double espresso for a stronger start.'),
  ('ristretto','Short, intense espresso shot.'),
  ('lungo','Espresso lengthened with water, milder taste.'),
  ('macchiato','Espresso topped with a dab of milk foam.'),
  ('cortado','Espresso balanced with warm milk.'),
  ('cappuccino','Espresso with creamy milk foam.'),
  ('flat_white','Double espresso with silky milk.'),
  ('caffe_latte','Mild coffee with plenty of warm milk.'),
  ('latte_macchiato','Layers of warm milk and espresso.'),
  ('americano','Espresso lengthened with hot water.'),
  ('mocha','Coffee with milk and chocolate.'),
  ('caramel_macchiato','Latte with caramel syrup and milk foam.'),
  ('affogato','Vanilla ice cream drowned in hot espresso.'),
  ('irish_coffee','Hot coffee with whiskey and whipped cream.'),
  ('vienna_coffee','Strong coffee crowned with whipped cream.'),
  ('cold_brew','Cold-brewed coffee, smooth and refreshing.'),
  ('iced_latte','Iced coffee with milk.'),
  -- Cocktails
  ('mojito','Refreshing cocktail with rum, lime and mint.'),
  ('margarita','Tequila, triple sec and lime with a salted rim.'),
  ('daiquiri','Rum, lime and sugar in perfect balance.'),
  ('negroni','Bittersweet: gin, Campari and vermouth.'),
  ('old_fashioned','Bourbon, sugar and bitters — a timeless classic.'),
  ('manhattan','Rye whiskey with sweet vermouth and bitters.'),
  ('cosmopolitan','Vodka, triple sec, lime and cranberry.'),
  ('mai_tai','Tropical blend of rum, lime and orgeat.'),
  ('pina_colada','Creamy cocktail with rum, coconut and pineapple.'),
  ('caipirinha','Brazilian classic: cachaça, lime and sugar.'),
  ('whiskey_sour','Bourbon, lemon and a silky foam.'),
  ('aperol_spritz','Aperol, prosecco and soda — a summer aperitif.'),
  ('tom_collins','Refreshing: gin, lemon and soda.'),
  ('gin_tonic','Gin and tonic with a lime wedge.'),
  ('cuba_libre','Rum, cola and lime.'),
  ('bloody_mary','Spicy vodka with tomato juice.'),
  ('long_island','A strong mix of five spirits with cola.'),
  ('espresso_martini','Vodka, coffee liqueur and espresso.'),
  ('moscow_mule','Vodka, lime and ginger beer.'),
  ('mimosa','Prosecco and orange juice.'),
  ('bellini','Prosecco with peach puree.'),
  ('sex_on_the_beach','Vodka, peach, orange and cranberry.'),
  ('tequila_sunrise','Tequila, orange and grenadine.'),
  ('dark_n_stormy','Dark rum and ginger beer.'),
  ('gimlet','Gin and lime, clean and fresh.'),
  ('white_russian','Vodka, coffee liqueur and cream.'),
  ('mint_julep','Bourbon, mint and sugar over ice.'),
  ('french_75','Gin, lemon and champagne — elegant.'),
  -- Soft drinks
  ('domaca_limunada','Homemade lemonade from fresh lemons.'),
  ('limunada_menta','Lemonade refreshed with mint leaves.'),
  ('ledeni_caj_breskva','Iced tea with peach flavour.'),
  ('ledeni_caj_limun','Iced tea with lemon.'),
  ('cijedjena_pomorandza','Freshly squeezed orange juice.'),
  ('frape_vanila','Creamy frappe with vanilla ice cream.'),
  ('frape_cokolada','Frappe with chocolate and ice cream.'),
  ('milkshake_jagoda','Milkshake with strawberry and milk.'),
  ('smoothie_sumsko','Smoothie with forest berries and banana.'),
  -- Hot drinks
  ('topla_cokolada','Thick hot chocolate.'),
  ('caj_nana','Mint tea, soothing and warm.'),
  ('crni_caj','Classic black tea.'),
  ('kakao','Warm cocoa with milk.'),
  -- Beer / wine / spirits
  ('toceno_pivo','Draft beer 0.5l.'),
  ('flasirano_pivo','Cold bottled beer.'),
  ('bijelo_vino','Glass of white wine.'),
  ('crno_vino','Glass of red wine.'),
  ('rakija_loza','Homemade grape brandy.'),
  ('rakija_kruska','Pear brandy.'),
  ('viski_casa','Glass of whisky.'),
  ('vinjak','Brandy.'),
  -- Hot dishes
  ('cevapi','Grilled ćevapi in flatbread with onion.'),
  ('pljeskavica','Juicy grilled meat patty.'),
  ('raznjici','Grilled pork skewers.'),
  ('mjesano_meso','A mix of grilled specialties.'),
  ('burek_meso','Pastry filled with minced meat.'),
  ('burek_sir','Pastry filled with cheese.'),
  ('sarma','Sauerkraut rolls with meat.'),
  ('punjene_paprike','Peppers stuffed with meat and rice.'),
  ('musaka','Moussaka with potato and minced meat.'),
  ('crni_rizoto','Squid risotto in its ink.'),
  ('pizza_margarita','Pizza with tomato and mozzarella.'),
  ('pizza_capricciosa','Pizza with ham, mushrooms and olives.'),
  ('pizza_quattro','Pizza with four cheeses.'),
  ('pizza_pepperoni','Pizza with spicy salami.'),
  ('pasta_bolognese','Spaghetti with bolognese sauce.'),
  ('pasta_carbonara','Spaghetti with bacon, egg and parmesan.'),
  ('pasta_napolitana','Spaghetti in tomato and basil sauce.'),
  ('pasta_pesto','Spaghetti with pesto and parmesan.'),
  ('burger_klasik','Juicy burger with patty and veggies.'),
  ('cheeseburger','Burger with melted cheese.'),
  ('piletina_burger','Burger with chicken fillet.'),
  -- Salads, starters, sides
  ('cezar_salata','Caesar salad with chicken and parmesan.'),
  ('grcka_salata','Greek salad with feta and olives.'),
  ('sopska_salata','Shopska salad with grated cheese.'),
  ('caprese','Tomato, mozzarella and basil.'),
  ('bruschette','Toasted bread with tomato and garlic.'),
  ('pomfrit','Crispy french fries.'),
  ('mozzarella_sticks','Breaded mozzarella sticks.'),
  ('sezonska_salata','Fresh seasonal salad.'),
  -- Breakfast
  ('omlet','Omelette with cheese.'),
  ('kajgana','Scrambled fresh eggs.'),
  ('palacinke_slatke','Pancakes with jam.'),
  ('americke_palacinke','Fluffy American pancakes with honey.'),
  -- Desserts
  ('baklava','Baklava with walnuts in syrup.'),
  ('cheesecake','Creamy cheesecake on a biscuit base.'),
  ('cokoladni_kolac','Rich chocolate cake.'),
  ('sladoled_kup','Ice cream cup with whipped cream and topping.'),
  ('palacinke_nutela','Pancakes with Nutella.'),
  ('vocna_salata','Seasonal fruit with honey.')
) AS v(id, descr)
WHERE r.id = v.id;

-- RPC: dodaj description_en (insert + backfill); ostalo isto kao 20260606000014.
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
  v_is_bar       BOOLEAN;
  v_category_id  UUID;
  v_existing     public.menu_items%ROWTYPE;
  v_menu_item_id UUID;
  v_menu_created BOOLEAN := false;
  v_inv_id       UUID;
  v_ing          RECORD;
  v_norm_plan    TEXT;
BEGIN
  SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restoran ne postoji'; END IF;
  IF NOT (v_rest.user_id = auth.uid() OR public.is_superadmin()) THEN
    RAISE EXCEPTION 'Nemate pravo na ovaj restoran';
  END IF;

  SELECT * INTO v_rec FROM public.recipe_library
   WHERE id = p_recipe_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recept ne postoji ili nije aktivan: %', p_recipe_id;
  END IF;

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

  IF p_category_id IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.categories
     WHERE id = p_category_id AND restaurant_id = p_restaurant_id;
  END IF;
  IF v_category_id IS NULL THEN
    CASE v_rec.category
      WHEN 'coffee'    THEN v_cat_name := 'Kafa';             v_cat_icon := '☕'; v_is_bar := true;
      WHEN 'cocktail'  THEN v_cat_name := 'Kokteli';          v_cat_icon := '🍸'; v_is_bar := true;
      WHEN 'soft'      THEN v_cat_name := 'Bezalkoholna';     v_cat_icon := '🥤'; v_is_bar := true;
      WHEN 'hot'       THEN v_cat_name := 'Topli napici';     v_cat_icon := '🍵'; v_is_bar := true;
      WHEN 'beverage'  THEN v_cat_name := 'Pića';             v_cat_icon := '🍺'; v_is_bar := true;
      WHEN 'food'      THEN v_cat_name := 'Jela';             v_cat_icon := '🍽️'; v_is_bar := false;
      WHEN 'salad'     THEN v_cat_name := 'Salate i predjela';v_cat_icon := '🥗'; v_is_bar := false;
      WHEN 'breakfast' THEN v_cat_name := 'Doručak';          v_cat_icon := '🍳'; v_is_bar := false;
      WHEN 'dessert'   THEN v_cat_name := 'Deserti';          v_cat_icon := '🍰'; v_is_bar := false;
      ELSE                  v_cat_name := 'Ostalo';           v_cat_icon := '🍽️'; v_is_bar := false;
    END CASE;

    SELECT id INTO v_category_id FROM public.categories
     WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_cat_name)
     LIMIT 1;
    IF v_category_id IS NULL THEN
      INSERT INTO public.categories (restaurant_id, name, icon, is_bar, sort_order)
      VALUES (p_restaurant_id, v_cat_name, v_cat_icon, v_is_bar,
              COALESCE((SELECT max(sort_order)+1 FROM public.categories
                        WHERE restaurant_id = p_restaurant_id), 0))
      RETURNING id INTO v_category_id;
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.menu_items
   WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_rec.name)
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    v_menu_item_id := v_existing.id;
    UPDATE public.menu_items SET
      image_url      = CASE WHEN (image_url IS NULL OR image_url = '') THEN v_rec.image_url ELSE image_url END,
      description    = CASE WHEN (description IS NULL OR description = '') THEN v_rec.instructions ELSE description END,
      description_en = CASE WHEN (description_en IS NULL OR description_en = '') THEN v_rec.description_en ELSE description_en END,
      allergens      = CASE WHEN (allergens IS NULL OR allergens = '') THEN v_rec.allergens ELSE allergens END,
      prep_time      = CASE WHEN (prep_time IS NULL OR prep_time = '') THEN v_rec.prep_time ELSE prep_time END,
      calories       = CASE WHEN calories IS NULL THEN v_rec.calories ELSE calories END
    WHERE id = v_menu_item_id;
  ELSE
    INSERT INTO public.menu_items
      (restaurant_id, category_id, name, name_en, description, description_en, price, emoji, image_url,
       allergens, calories, prep_time, is_visible, sort_order)
    VALUES
      (p_restaurant_id, v_category_id, v_rec.name, v_rec.name_en, v_rec.instructions, v_rec.description_en,
       COALESCE(v_rec.suggested_price, 0), COALESCE(v_rec.emoji, '🍽️'), v_rec.image_url,
       v_rec.allergens, v_rec.calories, v_rec.prep_time, true,
       COALESCE((SELECT max(sort_order)+1 FROM public.menu_items
                 WHERE restaurant_id = p_restaurant_id), 0))
    RETURNING id INTO v_menu_item_id;
    v_menu_created := true;
  END IF;

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
        VALUES (p_restaurant_id, v_ing.ingredient_name, v_ing.unit, 0, 'ostalo')
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
