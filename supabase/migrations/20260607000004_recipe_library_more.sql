-- Biblioteka dopuna: supe/čorbe, riblja i glavna jela, žestoko +, topli napici +,
-- prilozi, dječji meni, vegetarijansko.
-- Nove kategorije: soup, side, kids, vegetarian (RPC mapiranje dolje).
-- Kalorije/alergeni se računaju joinom na trajnu recipe_ingredient_nutrition.

-- ─── 1) Novi sastojci u nutritivnu tabelu ─────────────────────────────────────
INSERT INTO public.recipe_ingredient_nutrition (nm, kcal, allergens) VALUES
  ('rezanci',3.7,ARRAY['Gluten']), ('junetina',2.5,'{}'), ('celer',0.16,ARRAY['Celer']),
  ('šargarepa',0.41,'{}'), ('pasulj',1.27,'{}'), ('riba (bijela)',1.0,ARRAY['Riba']),
  ('orada',1.0,ARRAY['Riba']), ('brancin',1.0,ARRAY['Riba']), ('prezle',3.5,ARRAY['Gluten']),
  ('instant kafa',3.6,'{}'), ('blitva',0.2,'{}'), ('tikvice',0.17,'{}')
ON CONFLICT (nm) DO NOTHING;

-- ─── 2) RPC: dodate kategorije soup/side/kids/vegetarian (ostalo kao 20260607000001) ──
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
  v_has_recipe   BOOLEAN;
  v_inv_id       UUID;
  v_ing          RECORD;
  v_norm_plan    TEXT;
BEGIN
  SELECT * INTO v_rest FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restoran ne postoji'; END IF;
  IF NOT (v_rest.user_id = auth.uid() OR public.is_superadmin()) THEN
    RAISE EXCEPTION 'Nemate pravo na ovaj restoran';
  END IF;

  SELECT * INTO v_rec FROM public.recipe_library WHERE id = p_recipe_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recept ne postoji ili nije aktivan: %', p_recipe_id;
  END IF;

  v_norm_plan := CASE WHEN v_rest.plan = 'pro' THEN 'restaurant' ELSE COALESCE(v_rest.plan, 'starter') END;
  v_has_inv := v_rest.is_complimentary
    OR v_norm_plan IN ('restaurant','hotel','hotel_pro','enterprise')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.restaurant_id = p_restaurant_id
         AND ((CASE WHEN s.plan = 'pro' THEN 'restaurant' ELSE COALESCE(s.plan,'starter') END)
                IN ('restaurant','hotel','hotel_pro','enterprise')
              OR s.addons ? 'inventory_pro'));

  IF p_category_id IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.categories
     WHERE id = p_category_id AND restaurant_id = p_restaurant_id;
  END IF;
  IF v_category_id IS NULL THEN
    CASE v_rec.category
      WHEN 'coffee'     THEN v_cat_name := 'Kafa';             v_cat_icon := '☕'; v_is_bar := true;
      WHEN 'cocktail'   THEN v_cat_name := 'Kokteli';          v_cat_icon := '🍸'; v_is_bar := true;
      WHEN 'soft'       THEN v_cat_name := 'Bezalkoholna';     v_cat_icon := '🥤'; v_is_bar := true;
      WHEN 'hot'        THEN v_cat_name := 'Topli napici';     v_cat_icon := '🍵'; v_is_bar := true;
      WHEN 'beverage'   THEN v_cat_name := 'Pića';             v_cat_icon := '🍺'; v_is_bar := true;
      WHEN 'food'       THEN v_cat_name := 'Jela';             v_cat_icon := '🍽️'; v_is_bar := false;
      WHEN 'salad'      THEN v_cat_name := 'Salate i predjela';v_cat_icon := '🥗'; v_is_bar := false;
      WHEN 'breakfast'  THEN v_cat_name := 'Doručak';          v_cat_icon := '🍳'; v_is_bar := false;
      WHEN 'dessert'    THEN v_cat_name := 'Deserti';          v_cat_icon := '🍰'; v_is_bar := false;
      WHEN 'soup'       THEN v_cat_name := 'Supe i čorbe';     v_cat_icon := '🍲'; v_is_bar := false;
      WHEN 'side'       THEN v_cat_name := 'Prilozi';          v_cat_icon := '🍚'; v_is_bar := false;
      WHEN 'kids'       THEN v_cat_name := 'Dječji meni';      v_cat_icon := '🧒'; v_is_bar := false;
      WHEN 'vegetarian' THEN v_cat_name := 'Vegetarijansko';   v_cat_icon := '🥦'; v_is_bar := false;
      ELSE                   v_cat_name := 'Ostalo';           v_cat_icon := '🍽️'; v_is_bar := false;
    END CASE;

    SELECT id INTO v_category_id FROM public.categories
     WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_cat_name) LIMIT 1;
    IF v_category_id IS NULL THEN
      INSERT INTO public.categories (restaurant_id, name, icon, is_bar, sort_order)
      VALUES (p_restaurant_id, v_cat_name, v_cat_icon, v_is_bar,
              COALESCE((SELECT max(sort_order)+1 FROM public.categories WHERE restaurant_id = p_restaurant_id), 0))
      RETURNING id INTO v_category_id;
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.menu_items
   WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_rec.name) LIMIT 1;

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
       COALESCE((SELECT max(sort_order)+1 FROM public.menu_items WHERE restaurant_id = p_restaurant_id), 0))
    RETURNING id INTO v_menu_item_id;
    v_menu_created := true;
  END IF;

  IF v_has_inv THEN
    SELECT EXISTS (SELECT 1 FROM public.menu_item_ingredients WHERE menu_item_id = v_menu_item_id) INTO v_has_recipe;
    IF NOT v_has_recipe THEN
      FOR v_ing IN SELECT * FROM public.recipe_library_ingredients WHERE recipe_id = p_recipe_id ORDER BY sort_order LOOP
        SELECT id INTO v_inv_id FROM public.inventory_items
         WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_ing.ingredient_name) AND unit = v_ing.unit LIMIT 1;
        IF v_inv_id IS NULL THEN
          INSERT INTO public.inventory_items (restaurant_id, name, unit, quantity, category)
          VALUES (p_restaurant_id, v_ing.ingredient_name, v_ing.unit, 0, 'ostalo') RETURNING id INTO v_inv_id;
        END IF;
        INSERT INTO public.menu_item_ingredients (menu_item_id, inventory_item_id, quantity)
        VALUES (v_menu_item_id, v_inv_id, v_ing.quantity)
        ON CONFLICT (menu_item_id, inventory_item_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('menu_item_id', v_menu_item_id, 'menu_created', v_menu_created,
                            'recipe_imported', v_has_inv, 'recipe_skipped', (v_has_inv AND v_has_recipe),
                            'category_id', v_category_id);
END;
$$;

-- ─── 3) RECEPTI ───────────────────────────────────────────────────────────────
INSERT INTO public.recipe_library (id, name, name_en, category, emoji, suggested_price, prep_time, instructions, description_en, sort_order) VALUES
  -- Supe i čorbe
  ('pileca_supa','Pileća supa','Chicken Soup','soup','🍲',3.00,'10 min','Domaća pileća supa s rezancima.','Homemade chicken noodle soup.',2010),
  ('goveda_supa','Goveđa supa','Beef Soup','soup','🍲',3.00,'10 min','Goveđa supa s rezancima.','Beef noodle soup.',2020),
  ('krem_povrce','Krem supa od povrća','Cream of Vegetable Soup','soup','🥣',3.20,'10 min','Kremasta supa od sezonskog povrća.','Creamy seasonal vegetable soup.',2030),
  ('krem_peceurke','Krem supa od pečuraka','Cream of Mushroom Soup','soup','🥣',3.50,'10 min','Kremasta supa od pečuraka.','Creamy mushroom soup.',2040),
  ('riblja_corba','Riblja čorba','Fish Stew','soup','🐟',4.50,'15 min','Riblja čorba s krompirom.','Fish stew with potato.',2050),
  -- Riblja i glavna jela
  ('orada_zaru','Orada sa žara','Grilled Sea Bream','food','🐟',12.00,'20 min','Orada sa žara s maslinovim uljem.','Grilled sea bream with olive oil.',2110),
  ('brancin_zaru','Brancin sa žara','Grilled Sea Bass','food','🐟',13.00,'20 min','Brancin sa žara.','Grilled sea bass.',2120),
  ('lignje_zaru','Lignje sa žara','Grilled Squid','food','🦑',11.00,'18 min','Lignje sa žara s bijelim lukom.','Grilled squid with garlic.',2130),
  ('becka_snicla','Bečka šnicla','Wiener Schnitzel','food','🍖',9.00,'18 min','Pohovana svinjska šnicla.','Breaded pork schnitzel.',2140),
  ('pileci_file_zaru','Pileći file sa žara','Grilled Chicken Fillet','food','🍗',8.00,'15 min','Pileći file sa žara.','Grilled chicken fillet.',2150),
  ('gulas','Gulaš','Goulash','food','🥘',8.50,'25 min','Goveđi gulaš s paprikom.','Beef goulash with pepper.',2160),
  ('rizoto_pecurke','Rižoto s pečurkama','Mushroom Risotto','food','🍚',7.50,'18 min','Rižoto s pečurkama i parmezanom.','Mushroom risotto with parmesan.',2170),
  -- Topli napici +
  ('vocni_caj','Voćni čaj','Fruit Tea','hot','🍵',1.80,'3 min','Topli voćni čaj.','Hot fruit tea.',2210),
  ('kamilica','Čaj od kamilice','Chamomile Tea','hot','🍵',1.80,'3 min','Umirujući čaj od kamilice.','Soothing chamomile tea.',2220),
  ('zeleni_caj','Zeleni čaj','Green Tea','hot','🍵',1.80,'3 min','Zeleni čaj.','Green tea.',2230),
  ('nes_kafa','Nes kafa','Instant Coffee','hot','☕',1.80,'3 min','Instant kafa s mlijekom po želji.','Instant coffee.',2240),
  ('bijela_kafa','Bijela kafa','White Coffee','coffee','☕',1.80,'3 min','Espreso s toplim mlijekom.','Espresso with warm milk.',2250),
  -- Žestoko (stavke, bez recepta) — kalorije inline
  ('gin_pice','Džin (čaša)','Gin','beverage','🥃',3.00,'1 min',95,'Glass of gin.',2310),
  ('votka_pice','Votka (čaša)','Vodka','beverage','🥃',3.00,'1 min',95,'Glass of vodka.',2320),
  ('konjak','Konjak','Cognac','beverage','🥃',3.50,'1 min',100,'Cognac.',2330),
  ('liker_pice','Liker','Liqueur','beverage','🥃',3.00,'1 min',130,'Liqueur.',2340),
  ('grappa','Grappa','Grappa','beverage','🥃',3.00,'1 min',95,'Grappa.',2350),
  ('pelinkovac','Pelinkovac','Pelinkovac','beverage','🥃',2.50,'1 min',100,'Herbal bitter.',2360),
  -- Prilozi
  ('pirinac_prilog','Pirinač (prilog)','Rice (side)','side','🍚',2.50,'8 min','Kuvani pirinač s puterom.','Buttered rice.',2410),
  ('povrce_zaru','Povrće sa žara','Grilled Vegetables','side','🥗',3.50,'10 min','Sezonsko povrće sa žara.','Grilled seasonal vegetables.',2420),
  ('blitva_krompir','Blitva na lešo','Swiss Chard & Potato','side','🥬',3.50,'12 min','Blitva s krompirom i maslinovim uljem.','Swiss chard with potato.',2430),
  ('hljeb_prilog','Hljeb (korpa)','Bread basket','side','🥖',1.50,'1 min','Korpa hljeba.','Bread basket.',2440),
  ('djuvec_pirinac','Đuveč pirinač','Đuveč Rice','side','🍚',3.00,'12 min','Pirinač s povrćem.','Rice with vegetables.',2450),
  -- Dječji meni
  ('kids_piletina_pomfrit','Pileći nuggets s pomfritom','Chicken Nuggets & Fries','kids','🧒',5.50,'12 min','Pohovani pileći zalogaji s pomfritom.','Chicken nuggets with fries.',2510),
  ('kids_snicla_pomfrit','Pohovana šnicla s pomfritom','Breaded Cutlet & Fries','kids','🧒',6.00,'15 min','Dječja pohovana šnicla s pomfritom.','Breaded cutlet with fries.',2520),
  ('kids_pasta','Dječja pasta','Kids Pasta','kids','🍝',4.50,'10 min','Špageti u sosu od paradajza.','Spaghetti in tomato sauce.',2530),
  ('kids_palacinke','Dječje palačinke','Kids Pancakes','kids','🥞',3.50,'10 min','Palačinke s čokoladom.','Pancakes with chocolate.',2540),
  -- Vegetarijansko
  ('veg_rizoto','Vegetarijanski rižoto','Vegetarian Risotto','vegetarian','🥦',6.50,'18 min','Rižoto s povrćem i parmezanom.','Vegetable risotto with parmesan.',2610),
  ('veg_burger','Vegetarijanski burger','Veggie Burger','vegetarian','🥦',6.50,'12 min','Burger s povrćem i sirom.','Veggie burger with cheese.',2620),
  ('veg_pizza','Vegetarijanska pica','Vegetarian Pizza','vegetarian','🍕',6.50,'15 min','Pica s povrćem i mocarelom.','Pizza with vegetables and mozzarella.',2630),
  ('grilovano_povrce','Grilovano povrće','Grilled Vegetables Plate','vegetarian','🥦',5.50,'12 min','Tanjir grilovanog povrća.','Plate of grilled vegetables.',2640),
  ('punjene_tikvice','Punjene tikvice','Stuffed Zucchini','vegetarian','🥒',6.00,'20 min','Tikvice punjene pirinčem i sirom.','Zucchini stuffed with rice and cheese.',2650)
ON CONFLICT (id) DO NOTHING;

-- ─── 4) SASTOJCI ──────────────────────────────────────────────────────────────
INSERT INTO public.recipe_library_ingredients (recipe_id, ingredient_name, quantity, unit, sort_order) VALUES
  ('pileca_supa','Piletina',60,'g',1), ('pileca_supa','Šargarepa',40,'g',2), ('pileca_supa','Rezanci',40,'g',3), ('pileca_supa','Celer',20,'g',4),
  ('goveda_supa','Junetina',80,'g',1), ('goveda_supa','Šargarepa',40,'g',2), ('goveda_supa','Rezanci',40,'g',3),
  ('krem_povrce','Krompir',80,'g',1), ('krem_povrce','Šargarepa',60,'g',2), ('krem_povrce','Pavlaka',30,'ml',3),
  ('krem_peceurke','Pečurke',120,'g',1), ('krem_peceurke','Pavlaka',40,'ml',2), ('krem_peceurke','Crveni luk',20,'g',3),
  ('riblja_corba','Riba (bijela)',120,'g',1), ('riblja_corba','Krompir',60,'g',2), ('riblja_corba','Paradajz',40,'g',3),
  ('orada_zaru','Orada',300,'g',1), ('orada_zaru','Maslinovo ulje',15,'ml',2), ('orada_zaru','Bijeli luk',5,'g',3),
  ('brancin_zaru','Brancin',300,'g',1), ('brancin_zaru','Maslinovo ulje',15,'ml',2), ('brancin_zaru','Bijeli luk',5,'g',3),
  ('lignje_zaru','Lignje',250,'g',1), ('lignje_zaru','Maslinovo ulje',15,'ml',2), ('lignje_zaru','Bijeli luk',5,'g',3),
  ('becka_snicla','Svinjetina',180,'g',1), ('becka_snicla','Jaje',1,'kom',2), ('becka_snicla','Brašno',30,'g',3), ('becka_snicla','Prezle',40,'g',4), ('becka_snicla','Ulje',40,'ml',5),
  ('pileci_file_zaru','Piletina',220,'g',1), ('pileci_file_zaru','Maslinovo ulje',10,'ml',2),
  ('gulas','Junetina',200,'g',1), ('gulas','Crveni luk',40,'g',2), ('gulas','Paprika',30,'g',3), ('gulas','Pasata (paradajz)',60,'g',4),
  ('rizoto_pecurke','Pirinač',80,'g',1), ('rizoto_pecurke','Pečurke',100,'g',2), ('rizoto_pecurke','Parmezan',20,'g',3), ('rizoto_pecurke','Maslinovo ulje',10,'ml',4),
  ('vocni_caj','Čaj (kesica)',1,'kom',1), ('vocni_caj','Voda',200,'ml',2),
  ('kamilica','Čaj (kesica)',1,'kom',1), ('kamilica','Voda',200,'ml',2),
  ('zeleni_caj','Čaj (kesica)',1,'kom',1), ('zeleni_caj','Voda',200,'ml',2),
  ('nes_kafa','Instant kafa',3,'g',1), ('nes_kafa','Voda',150,'ml',2), ('nes_kafa','Šećer',5,'g',3),
  ('bijela_kafa','Kafa (espreso)',7,'g',1), ('bijela_kafa','Mlijeko',100,'ml',2),
  ('pirinac_prilog','Pirinač',100,'g',1), ('pirinac_prilog','Puter',10,'g',2),
  ('povrce_zaru','Paprika',60,'g',1), ('povrce_zaru','Pečurke',50,'g',2), ('povrce_zaru','Tikvice',50,'g',3), ('povrce_zaru','Maslinovo ulje',10,'ml',4),
  ('blitva_krompir','Blitva',150,'g',1), ('blitva_krompir','Krompir',100,'g',2), ('blitva_krompir','Maslinovo ulje',10,'ml',3),
  ('hljeb_prilog','Hljeb',100,'g',1),
  ('djuvec_pirinac','Pirinač',100,'g',1), ('djuvec_pirinac','Paprika',30,'g',2), ('djuvec_pirinac','Pasata (paradajz)',40,'g',3),
  ('kids_piletina_pomfrit','Piletina',120,'g',1), ('kids_piletina_pomfrit','Prezle',30,'g',2), ('kids_piletina_pomfrit','Pomfrit (smrznuti)',150,'g',3), ('kids_piletina_pomfrit','Ulje',40,'ml',4),
  ('kids_snicla_pomfrit','Svinjetina',120,'g',1), ('kids_snicla_pomfrit','Jaje',1,'kom',2), ('kids_snicla_pomfrit','Prezle',30,'g',3), ('kids_snicla_pomfrit','Pomfrit (smrznuti)',150,'g',4), ('kids_snicla_pomfrit','Ulje',40,'ml',5),
  ('kids_pasta','Špageti',100,'g',1), ('kids_pasta','Pasata (paradajz)',80,'g',2),
  ('kids_palacinke','Brašno',80,'g',1), ('kids_palacinke','Jaje',1,'kom',2), ('kids_palacinke','Mlijeko',150,'ml',3), ('kids_palacinke','Čokoladni sirup',20,'ml',4),
  ('veg_rizoto','Pirinač',80,'g',1), ('veg_rizoto','Pečurke',80,'g',2), ('veg_rizoto','Paprika',40,'g',3), ('veg_rizoto','Parmezan',20,'g',4),
  ('veg_burger','Pecivo (burger)',1,'kom',1), ('veg_burger','Mocarela',40,'g',2), ('veg_burger','Zelena salata',20,'g',3), ('veg_burger','Paradajz',30,'g',4),
  ('veg_pizza','Brašno',200,'g',1), ('veg_pizza','Pasata (paradajz)',80,'g',2), ('veg_pizza','Mocarela',100,'g',3), ('veg_pizza','Pečurke',40,'g',4), ('veg_pizza','Paprika',40,'g',5), ('veg_pizza','Maslina',20,'g',6),
  ('grilovano_povrce','Paprika',60,'g',1), ('grilovano_povrce','Pečurke',60,'g',2), ('grilovano_povrce','Tikvice',60,'g',3), ('grilovano_povrce','Maslinovo ulje',15,'ml',4),
  ('punjene_tikvice','Tikvice',200,'g',1), ('punjene_tikvice','Pirinač',40,'g',2), ('punjene_tikvice','Sir',50,'g',3)
ON CONFLICT DO NOTHING;

-- ─── 5) Izračun kalorija + alergena za nove recepte (calories/allergens još NULL) ──
UPDATE public.recipe_library r SET calories = sub.kcal
FROM (
  SELECT ri.recipe_id, round(sum(ri.quantity * COALESCE(n.kcal,0)))::int AS kcal
  FROM public.recipe_library_ingredients ri
  LEFT JOIN public.recipe_ingredient_nutrition n ON lower(ri.ingredient_name) = n.nm
  GROUP BY ri.recipe_id
) sub
WHERE sub.recipe_id = r.id AND r.calories IS NULL;

UPDATE public.recipe_library r SET allergens = sub.al
FROM (
  SELECT ri.recipe_id, string_agg(DISTINCT a, ', ' ORDER BY a) AS al
  FROM public.recipe_library_ingredients ri
  JOIN public.recipe_ingredient_nutrition n ON lower(ri.ingredient_name) = n.nm
  CROSS JOIN LATERAL unnest(n.allergens) AS a
  GROUP BY ri.recipe_id
) sub
WHERE sub.recipe_id = r.id AND r.allergens IS NULL;
