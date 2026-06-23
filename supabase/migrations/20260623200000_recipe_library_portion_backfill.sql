-- Backfill gramaže (portion) za zatečene stavke biblioteke
--
-- ZAŠTO: portion je dodat u 20260623170000; stavke iz ranijih migracija nemaju
-- vrijednost pa se u galeriji i pri uvozu ne bi vidjela gramaža. Ovdje popunjavamo
-- portion SAMO gdje je NULL (nove stavke iz 20260623180000 već imaju vrijednost,
-- a eventualni superadmin override se ne gazi). Pića imaju standardne volumene;
-- hrana okvirne grame po kategoriji (tenant doradi nakon uvoza).

-- ─── 1) Specifične vrijednosti (pića po standardnom volumenu, hrana okvirno) ──
UPDATE public.recipe_library r SET portion = v.p
FROM (VALUES
  -- Kafa
  ('espresso','0.03 l'), ('doppio','0.06 l'), ('ristretto','0.02 l'), ('lungo','0.06 l'),
  ('macchiato','0.04 l'), ('cortado','0.08 l'), ('cappuccino','0.15 l'), ('flat_white','0.16 l'),
  ('caffe_latte','0.25 l'), ('latte_macchiato','0.25 l'), ('americano','0.2 l'), ('mocha','0.25 l'),
  ('caramel_macchiato','0.25 l'), ('affogato','0.1 l'), ('irish_coffee','0.2 l'), ('vienna_coffee','0.2 l'),
  ('cold_brew','0.3 l'), ('iced_latte','0.3 l'),
  -- Kokteli
  ('mojito','0.3 l'), ('margarita','0.15 l'), ('daiquiri','0.12 l'), ('negroni','0.1 l'),
  ('old_fashioned','0.1 l'), ('manhattan','0.1 l'), ('cosmopolitan','0.12 l'), ('mai_tai','0.2 l'),
  ('pina_colada','0.25 l'), ('caipirinha','0.2 l'), ('whiskey_sour','0.12 l'), ('aperol_spritz','0.2 l'),
  -- Bezalkoholna
  ('cola','0.33 l'), ('cola_zero','0.33 l'), ('fanta','0.33 l'), ('sprite','0.33 l'),
  ('bitter_lemon','0.25 l'), ('tonik_pice','0.25 l'), ('cockta','0.275 l'), ('red_bull','0.25 l'),
  ('kisela_voda','0.33 l'), ('negazirana_voda','0.33 l'), ('domaca_limunada','0.3 l'),
  ('limunada_menta','0.3 l'), ('ledeni_caj_breskva','0.3 l'), ('ledeni_caj_limun','0.3 l'),
  ('cijedjena_pomorandza','0.25 l'), ('frape_vanila','0.3 l'), ('frape_cokolada','0.3 l'),
  ('milkshake_jagoda','0.3 l'), ('smoothie_sumsko','0.3 l'),
  -- Topli napici
  ('topla_cokolada','0.2 l'), ('caj_nana','0.2 l'), ('crni_caj','0.2 l'), ('kakao','0.2 l'),
  ('vocni_caj','0.2 l'), ('kamilica','0.2 l'), ('zeleni_caj','0.2 l'), ('nes_kafa','0.2 l'),
  ('bijela_kafa','0.15 l'),
  -- Pića (pivo/vino/žestoko)
  ('toceno_pivo','0.5 l'), ('flasirano_pivo','0.33 l'), ('bijelo_vino','0.1 l'), ('crno_vino','0.1 l'),
  ('rakija_loza','0.03 l'), ('rakija_kruska','0.03 l'), ('viski_casa','0.03 l'), ('vinjak','0.03 l'),
  ('gin_pice','0.03 l'), ('votka_pice','0.03 l'), ('konjak','0.03 l'), ('liker_pice','0.04 l'),
  ('grappa','0.03 l'), ('pelinkovac','0.03 l'),
  -- Topla jela
  ('cevapi','10 kom'), ('pljeskavica','250 g'), ('raznjici','250 g'), ('mjesano_meso','400 g'),
  ('burek_meso','250 g'), ('burek_sir','250 g'), ('sarma','2 kom'), ('punjene_paprike','2 kom'),
  ('musaka','350 g'), ('crni_rizoto','350 g'), ('pizza_margarita','Ø 30 cm'), ('pizza_capricciosa','Ø 30 cm'),
  ('pizza_quattro','Ø 30 cm'), ('pizza_pepperoni','Ø 30 cm'), ('pasta_bolognese','350 g'),
  ('pasta_carbonara','350 g'), ('pasta_napolitana','350 g'), ('pasta_pesto','350 g'),
  ('burger_klasik','250 g'), ('cheeseburger','270 g'), ('piletina_burger','250 g'),
  ('orada_zaru','300 g'), ('brancin_zaru','300 g'), ('lignje_zaru','250 g'), ('becka_snicla','250 g'),
  ('pileci_file_zaru','220 g'), ('gulas','350 g'), ('rizoto_pecurke','350 g'),
  -- Salate, predjela, prilozi
  ('cezar_salata','300 g'), ('grcka_salata','300 g'), ('sopska_salata','300 g'), ('caprese','250 g'),
  ('bruschette','200 g'), ('pomfrit','200 g'), ('mozzarella_sticks','180 g'), ('sezonska_salata','250 g'),
  -- Doručak
  ('omlet','200 g'), ('kajgana','180 g'), ('palacinke_slatke','3 kom'), ('americke_palacinke','3 kom'),
  -- Deserti
  ('baklava','150 g'), ('cheesecake','150 g'), ('cokoladni_kolac','150 g'), ('sladoled_kup','3 kugle'),
  ('palacinke_nutela','2 kom'), ('vocna_salata','250 g'),
  -- Supe i čorbe
  ('pileca_supa','300 ml'), ('goveda_supa','300 ml'), ('krem_povrce','300 ml'),
  ('krem_peceurke','300 ml'), ('riblja_corba','300 ml'),
  -- Prilozi
  ('pirinac_prilog','200 g'), ('povrce_zaru','200 g'), ('blitva_krompir','250 g'),
  ('hljeb_prilog','150 g'), ('djuvec_pirinac','250 g'),
  -- Dječji meni
  ('kids_piletina_pomfrit','250 g'), ('kids_snicla_pomfrit','250 g'), ('kids_pasta','250 g'),
  ('kids_palacinke','2 kom'),
  -- Vegetarijansko
  ('veg_rizoto','350 g'), ('veg_burger','250 g'), ('veg_pizza','Ø 30 cm'),
  ('grilovano_povrce','300 g'), ('punjene_tikvice','2 kom')
) AS v(id, p)
WHERE r.id = v.id AND r.portion IS NULL;

-- ─── 2) Fallback po kategoriji za sve preostale (npr. dodatni kokteli/deserti) ──
UPDATE public.recipe_library SET portion = CASE category
    WHEN 'coffee'     THEN '0.2 l'
    WHEN 'cocktail'   THEN '0.2 l'
    WHEN 'soft'       THEN '0.25 l'
    WHEN 'hot'        THEN '0.2 l'
    WHEN 'beverage'   THEN '0.03 l'
    WHEN 'food'       THEN '300 g'
    WHEN 'salad'      THEN '250 g'
    WHEN 'breakfast'  THEN '200 g'
    WHEN 'dessert'    THEN '150 g'
    WHEN 'soup'       THEN '300 ml'
    WHEN 'side'       THEN '200 g'
    WHEN 'kids'       THEN '250 g'
    WHEN 'vegetarian' THEN '300 g'
    ELSE NULL
  END
WHERE portion IS NULL;
