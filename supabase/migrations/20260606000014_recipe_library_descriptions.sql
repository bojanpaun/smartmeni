-- Opisi za biblioteku recepata (menu_items.description preko recipe_library.instructions)
--
-- ZAŠTO: do sada instructions nije popunjavan pa su uvezene stavke bile bez opisa.
-- Kratki, primamljivi opisi (crnogorski) za sve stavke. RPC se dopunjava da opis
-- popuni i na već uvezenim stavkama koje su bez opisa (admin tekst se ne gazi).

UPDATE public.recipe_library r SET instructions = v.descr
FROM (VALUES
  -- Kafa
  ('espresso','Klasičan italijanski espreso — koncentrovan i aromatičan.'),
  ('doppio','Dupli espreso za jači start dana.'),
  ('ristretto','Kratak, intenzivan špric espresa.'),
  ('lungo','Espreso produžen vodom, blaži ukus.'),
  ('macchiato','Espreso s kapom tople mliječne pjene.'),
  ('cortado','Espreso u ravnoteži s toplim mlijekom.'),
  ('cappuccino','Espreso sa kremastom mliječnom pjenom.'),
  ('flat_white','Dupli espreso sa svilenkastim mlijekom.'),
  ('caffe_latte','Blaga kafa s puno toplog mlijeka.'),
  ('latte_macchiato','Slojevi toplog mlijeka i espresa.'),
  ('americano','Espreso produžen vrućom vodom.'),
  ('mocha','Kafa s mlijekom i čokoladom.'),
  ('caramel_macchiato','Latte s karamel sirupom i mliječnom pjenom.'),
  ('affogato','Sladoled od vanile preliven vrućim espresom.'),
  ('irish_coffee','Topla kafa s viskijem i šlagom.'),
  ('vienna_coffee','Jaka kafa krunisana šlagom.'),
  ('cold_brew','Hladno ceđena kafa, blaga i osvježavajuća.'),
  ('iced_latte','Ledena kafa s mlijekom.'),
  -- Kokteli
  ('mojito','Osvježavajući koktel s rumom, limetom i mentom.'),
  ('margarita','Tekila, triple sec i limeta uz slani obod.'),
  ('daiquiri','Rum, limeta i šećer u savršenoj ravnoteži.'),
  ('negroni','Gorko-aromatičan: džin, Campari i vermut.'),
  ('old_fashioned','Burbon, šećer i biter — bezvremenski klasik.'),
  ('manhattan','Ražani viski s crvenim vermutom i biterom.'),
  ('cosmopolitan','Votka, triple sec, limeta i brusnica.'),
  ('mai_tai','Tropski miks ruma, limete i orgeata.'),
  ('pina_colada','Kremasti koktel s rumom, kokosom i ananasom.'),
  ('caipirinha','Brazilski klasik: cachaça, limeta i šećer.'),
  ('whiskey_sour','Burbon, limun i nota svilenkaste pjene.'),
  ('aperol_spritz','Aperol, prosecco i soda — ljetni aperitiv.'),
  ('tom_collins','Osvježavajuće: džin, limun i soda.'),
  ('gin_tonic','Džin i tonik uz krišku limete.'),
  ('cuba_libre','Rum, cola i limeta.'),
  ('bloody_mary','Pikantna votka sa sokom od paradajza.'),
  ('long_island','Snažan miks pet pića s colom.'),
  ('espresso_martini','Votka, liker od kafe i espreso.'),
  ('moscow_mule','Votka, limeta i đumbirovo pivo.'),
  ('mimosa','Prosecco i sok od pomorandže.'),
  ('bellini','Prosecco s pireom od breskve.'),
  ('sex_on_the_beach','Votka, breskva, pomorandža i brusnica.'),
  ('tequila_sunrise','Tekila, pomorandža i grenadina.'),
  ('dark_n_stormy','Tamni rum i đumbirovo pivo.'),
  ('gimlet','Džin i sok od limete, čisto i svježe.'),
  ('white_russian','Votka, liker od kafe i pavlaka.'),
  ('mint_julep','Burbon, menta i šećer uz led.'),
  ('french_75','Džin, limun i šampanjac — elegantno.'),
  -- Bezalkoholna
  ('domaca_limunada','Domaća limunada od svježeg limuna.'),
  ('limunada_menta','Limunada osvježena listićima mente.'),
  ('ledeni_caj_breskva','Ledeni čaj s aromom breskve.'),
  ('ledeni_caj_limun','Ledeni čaj s limunom.'),
  ('cijedjena_pomorandza','Svježe ceđena pomorandža.'),
  ('frape_vanila','Kremasti frape sa sladoledom od vanile.'),
  ('frape_cokolada','Frape s čokoladom i sladoledom.'),
  ('milkshake_jagoda','Milkshake s jagodom i mlijekom.'),
  ('smoothie_sumsko','Smoothie od šumskog voća i banane.'),
  -- Topli napici
  ('topla_cokolada','Gusta topla čokolada.'),
  ('caj_nana','Čaj od nane, umirujuć i topao.'),
  ('crni_caj','Klasičan crni čaj.'),
  ('kakao','Topli kakao s mlijekom.'),
  -- Pivo / vino / žestoko
  ('toceno_pivo','Točeno pivo 0.5l.'),
  ('flasirano_pivo','Hladno flaširano pivo.'),
  ('bijelo_vino','Čaša bijelog vina.'),
  ('crno_vino','Čaša crnog vina.'),
  ('rakija_loza','Domaća lozova rakija.'),
  ('rakija_kruska','Kruškova rakija.'),
  ('viski_casa','Čaša viskija.'),
  ('vinjak','Vinjak.'),
  -- Topla jela
  ('cevapi','Roštiljski ćevapi u lepinji s lukom.'),
  ('pljeskavica','Sočna pljeskavica s roštilja.'),
  ('raznjici','Ražnjići od svinjetine s roštilja.'),
  ('mjesano_meso','Miks roštiljskih specijaliteta.'),
  ('burek_meso','Burek punjen mljevenim mesom.'),
  ('burek_sir','Burek punjen sirom.'),
  ('sarma','Sarma od kiselog kupusa s mesom.'),
  ('punjene_paprike','Paprike punjene mesom i pirinčem.'),
  ('musaka','Musaka od krompira i mljevenog mesa.'),
  ('crni_rizoto','Rižoto od lignji u crnilu.'),
  ('pizza_margarita','Pica s paradajzom i mocarelom.'),
  ('pizza_capricciosa','Pica s pršutom, pečurkama i maslinama.'),
  ('pizza_quattro','Pica sa četiri vrste sira.'),
  ('pizza_pepperoni','Pica s pikantnom salamom.'),
  ('pasta_bolognese','Špageti s bolonjez sosom.'),
  ('pasta_carbonara','Špageti sa slaninom, jajetom i parmezanom.'),
  ('pasta_napolitana','Špageti u sosu od paradajza i bosiljka.'),
  ('pasta_pesto','Špageti s pesto sosom i parmezanom.'),
  ('burger_klasik','Sočni burger s pljeskavicom i povrćem.'),
  ('cheeseburger','Burger s topljenim kačkavaljem.'),
  ('piletina_burger','Burger s pilećim fileom.'),
  -- Salate, predjela, prilozi
  ('cezar_salata','Cezar salata s piletinom i parmezanom.'),
  ('grcka_salata','Grčka salata s fetom i maslinama.'),
  ('sopska_salata','Šopska salata s rendanim sirom.'),
  ('caprese','Paradajz, mocarela i bosiljak.'),
  ('bruschette','Tostirani hljeb s paradajzom i bijelim lukom.'),
  ('pomfrit','Hrskavi pomfrit.'),
  ('mozzarella_sticks','Pohovani štapići mocarele.'),
  ('sezonska_salata','Svježa sezonska salata.'),
  -- Doručak
  ('omlet','Omlet sa sirom.'),
  ('kajgana','Kajgana od svježih jaja.'),
  ('palacinke_slatke','Palačinke s džemom.'),
  ('americke_palacinke','Pufnaste američke palačinke s medom.'),
  -- Deserti
  ('baklava','Baklava s orasima u sirupu.'),
  ('cheesecake','Kremasti cheesecake na podlozi od keksa.'),
  ('cokoladni_kolac','Bogati čokoladni kolač.'),
  ('sladoled_kup','Kup sladoleda sa šlagom i preljevom.'),
  ('palacinke_nutela','Palačinke s Nutelom.'),
  ('vocna_salata','Sezonsko voće s medom.')
) AS v(id, descr)
WHERE r.id = v.id;

-- RPC: dopuna — backfill opisa na postojećoj stavci (ostalo isto kao 20260606000013).
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
      image_url   = CASE WHEN (image_url IS NULL OR image_url = '') THEN v_rec.image_url ELSE image_url END,
      description = CASE WHEN (description IS NULL OR description = '') THEN v_rec.instructions ELSE description END,
      allergens   = CASE WHEN (allergens IS NULL OR allergens = '') THEN v_rec.allergens ELSE allergens END,
      prep_time   = CASE WHEN (prep_time IS NULL OR prep_time = '') THEN v_rec.prep_time ELSE prep_time END,
      calories    = CASE WHEN calories IS NULL THEN v_rec.calories ELSE calories END
    WHERE id = v_menu_item_id;
  ELSE
    INSERT INTO public.menu_items
      (restaurant_id, category_id, name, name_en, description, price, emoji, image_url,
       allergens, calories, prep_time, is_visible, sort_order)
    VALUES
      (p_restaurant_id, v_category_id, v_rec.name, v_rec.name_en, v_rec.instructions,
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
