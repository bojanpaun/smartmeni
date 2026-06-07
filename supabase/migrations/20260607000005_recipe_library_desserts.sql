-- Biblioteka: proširenje deserta + sladoleda (kategorija 'dessert' već postoji)
-- Kalorije/alergeni računati joinom na recipe_ingredient_nutrition.

-- 1) Novi sastojci (vrste sladoleda + jabuka/cimet)
INSERT INTO public.recipe_ingredient_nutrition (nm, kcal, allergens) VALUES
  ('jabuka',0.52,'{}'), ('cimet',2.5,'{}'),
  ('sladoled (čokolada)',145,ARRAY['Mlijeko']),
  ('sladoled (jagoda)',130,ARRAY['Mlijeko']),
  ('sladoled (lješnik)',150,ARRAY['Mlijeko','Orašasti plodovi']),
  ('sladoled (limun)',120,'{}')
ON CONFLICT (nm) DO NOTHING;

-- 2) Recepti
INSERT INTO public.recipe_library (id, name, name_en, category, emoji, suggested_price, prep_time, instructions, description_en, sort_order) VALUES
  ('tiramisu',        'Tiramisu',                 'Tiramisu',            'dessert','🍰',3.80,'5 min','Italijanski desert s kafom i mascarpone kremom.','Italian coffee & mascarpone dessert.',770),
  ('panna_cotta',     'Panna cotta',              'Panna Cotta',         'dessert','🍮',3.50,'5 min','Kremasti desert od vrhnja s preljevom.','Creamy panna cotta with topping.',780),
  ('krempita',        'Krempita',                 'Custard Slice',       'dessert','🍰',3.00,'5 min','Krem-pita s vanilom.','Vanilla custard slice.',790),
  ('princes_krofna',  'Princes krofna',           'Cream Puff',          'dessert','🧁',2.80,'5 min','Krofna punjena šlagom, prelivenja čokoladom.','Cream puff with chocolate.',800),
  ('strudla_jabuka',  'Štrudla od jabuka',        'Apple Strudel',       'dessert','🥧',3.20,'6 min','Štrudla s jabukama, orasima i cimetom.','Apple strudel with walnuts and cinnamon.',810),
  ('coko_sufle',      'Čokoladni sufle',          'Chocolate Soufflé',   'dessert','🍫',4.00,'8 min','Topli čokoladni sufle s tečnim središtem.','Warm chocolate soufflé.',820),
  ('vocni_pohar',     'Voćni pohar sa sladoledom','Fruit & Ice Cream Cup','dessert','🍨',3.80,'4 min','Sezonsko voće sa sladoledom i šlagom.','Seasonal fruit with ice cream.',830),
  -- Sladoledi
  ('kugla_vanila',    'Sladoled vanila (kugla)',  'Vanilla Scoop',       'dessert','🍦',1.20,'2 min','Kugla sladoleda od vanile.','Scoop of vanilla ice cream.',840),
  ('kugla_cokolada',  'Sladoled čokolada (kugla)','Chocolate Scoop',     'dessert','🍫',1.20,'2 min','Kugla sladoleda od čokolade.','Scoop of chocolate ice cream.',850),
  ('kugla_jagoda',    'Sladoled jagoda (kugla)',  'Strawberry Scoop',    'dessert','🍓',1.20,'2 min','Kugla sladoleda od jagode.','Scoop of strawberry ice cream.',860),
  ('kugla_ljesnik',   'Sladoled lješnik (kugla)', 'Hazelnut Scoop',      'dessert','🌰',1.20,'2 min','Kugla sladoleda od lješnika.','Scoop of hazelnut ice cream.',870),
  ('kugla_limun',     'Sladoled limun (kugla)',   'Lemon Sorbet Scoop',  'dessert','🍋',1.20,'2 min','Kugla limun sorbeta.','Scoop of lemon sorbet.',880),
  ('banana_split',    'Banana split',             'Banana Split',        'dessert','🍌',4.50,'4 min','Banana, sladoled, šlag, čokolada i orasi.','Banana, ice cream, cream, chocolate and nuts.',890),
  ('sladoled_kup_mix','Sladoled kup (mix)',       'Mixed Ice Cream Cup', 'dessert','🍨',3.50,'3 min','Kup s tri vrste sladoleda i šlagom.','Cup with three scoops and cream.',900)
ON CONFLICT (id) DO NOTHING;

-- 3) Sastojci
INSERT INTO public.recipe_library_ingredients (recipe_id, ingredient_name, quantity, unit, sort_order) VALUES
  ('tiramisu','Keks',60,'g',1), ('tiramisu','Krem sir',100,'g',2), ('tiramisu','Jaje',1,'kom',3), ('tiramisu','Kafa (espreso)',7,'g',4), ('tiramisu','Šećer',30,'g',5), ('tiramisu','Kakao prah',5,'g',6),
  ('panna_cotta','Pavlaka',150,'ml',1), ('panna_cotta','Šlag',30,'ml',2), ('panna_cotta','Šećer',30,'g',3),
  ('krempita','Mlijeko',200,'ml',1), ('krempita','Jaje',2,'kom',2), ('krempita','Šećer',40,'g',3), ('krempita','Brašno',20,'g',4), ('krempita','Kora za pitu',40,'g',5),
  ('princes_krofna','Brašno',40,'g',1), ('princes_krofna','Jaje',1,'kom',2), ('princes_krofna','Šlag',40,'ml',3), ('princes_krofna','Čokolada',20,'g',4),
  ('strudla_jabuka','Kora za pitu',80,'g',1), ('strudla_jabuka','Jabuka',150,'g',2), ('strudla_jabuka','Šećer',30,'g',3), ('strudla_jabuka','Orasi',20,'g',4), ('strudla_jabuka','Cimet',2,'g',5),
  ('coko_sufle','Čokolada',60,'g',1), ('coko_sufle','Jaje',2,'kom',2), ('coko_sufle','Puter',30,'g',3), ('coko_sufle','Šećer',30,'g',4), ('coko_sufle','Brašno',20,'g',5),
  ('vocni_pohar','Voće (sezonsko)',150,'g',1), ('vocni_pohar','Sladoled (vanila)',1,'kom',2), ('vocni_pohar','Šlag',20,'ml',3),
  ('kugla_vanila','Sladoled (vanila)',1,'kom',1),
  ('kugla_cokolada','Sladoled (čokolada)',1,'kom',1),
  ('kugla_jagoda','Sladoled (jagoda)',1,'kom',1),
  ('kugla_ljesnik','Sladoled (lješnik)',1,'kom',1),
  ('kugla_limun','Sladoled (limun)',1,'kom',1),
  ('banana_split','Banana',1,'kom',1), ('banana_split','Sladoled (vanila)',1,'kom',2), ('banana_split','Sladoled (čokolada)',1,'kom',3), ('banana_split','Šlag',30,'ml',4), ('banana_split','Čokoladni sirup',20,'ml',5), ('banana_split','Orasi',10,'g',6),
  ('sladoled_kup_mix','Sladoled (vanila)',1,'kom',1), ('sladoled_kup_mix','Sladoled (čokolada)',1,'kom',2), ('sladoled_kup_mix','Sladoled (jagoda)',1,'kom',3), ('sladoled_kup_mix','Šlag',30,'ml',4)
ON CONFLICT DO NOTHING;

-- 4) Izračun kalorija + alergena za nove (calories/allergens NULL)
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
