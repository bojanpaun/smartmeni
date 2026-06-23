-- Biblioteka — veliko proširenje pića i supa/čorbi (balkanski fokus)
--
-- ZAŠTO: tenant treba bogat katalog za bar i kuhinju. Dodaju se:
--   • sokovi (cijeđeni + flaširani/pakovani prirodni),
--   • gazirana i negazirana bezalkoholna pića, točena bezalkoholna,
--   • čajevi (topli napici),
--   • piva balkanskog regiona (flaširana i točena) + nekoliko internacionalnih,
--   • žestoka pića s naglaskom na balkanske rakije + vina balkanskog podneblja,
--   • supe i čorbe.
--
-- Kupljeni proizvodi (pivo/vino/žestoko/flaširani sok/voda) NEMAJU recept/BOM —
-- kalorije i alergeni se postavljaju INLINE (kao u 20260606000012 / 20260607000003).
-- Supe nose okvirne kalorije inline (bez BOM-a) da uvoz odmah ima podatak.
-- 'portion' (gramaža/količina) se popunjava za sve (vidi 20260623170000).
-- instructions = opis (me, → menu_items.description); description_en = EN opis.

-- ─── SOKOVI — cijeđeni (fresh) ────────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('cijedjeni_grejp',    'Cijeđeni grejp',      'Fresh Grapefruit Juice','soft','🍊', 3.20, '2 min', 80,  NULL, 'Svježe cijeđeni sok od grejpa.',        'Freshly squeezed grapefruit juice.', '0.2 l', 3010),
  ('cijedjena_jabuka',   'Cijeđena jabuka',     'Fresh Apple Juice',     'soft','🍏', 3.00, '2 min', 95,  NULL, 'Svježe cijeđeni sok od jabuke.',        'Freshly squeezed apple juice.',      '0.2 l', 3020),
  ('cijedjena_sargarepa','Cijeđena šargarepa',  'Fresh Carrot Juice',    'soft','🥕', 3.20, '2 min', 70,  NULL, 'Svježe cijeđeni sok od šargarepe.',     'Freshly squeezed carrot juice.',     '0.2 l', 3030),
  ('cijedjena_cvekla',   'Cijeđena cvekla',     'Fresh Beetroot Juice',  'soft','🟣', 3.40, '2 min', 80,  NULL, 'Svježe cijeđeni sok od cvekle.',        'Freshly squeezed beetroot juice.',   '0.2 l', 3040),
  ('cijedjeni_mix',      'Cijeđeni mix voća',   'Fresh Mixed Juice',     'soft','🍹', 3.50, '2 min', 100, NULL, 'Mix svježe cijeđenog sezonskog voća.',  'Mixed seasonal fresh juice.',        '0.2 l', 3050)
ON CONFLICT (id) DO NOTHING;

-- ─── SOKOVI — flaširani / pakovani prirodni ──────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('sok_jabuka',      'Sok od jabuke',      'Apple Juice',       'soft','🧃', 2.50, '1 min', 96,  NULL, 'Prirodni sok od jabuke.',        'Natural apple juice.',        '0.2 l', 3110),
  ('sok_pomorandza',  'Sok od pomorandže',  'Orange Juice',      'soft','🍊', 2.50, '1 min', 90,  NULL, 'Prirodni sok od pomorandže.',    'Natural orange juice.',       '0.2 l', 3120),
  ('sok_breskva',     'Sok od breskve',     'Peach Juice',       'soft','🍑', 2.50, '1 min', 100, NULL, 'Sok od breskve.',                'Peach juice.',                '0.2 l', 3130),
  ('sok_jagoda',      'Sok od jagode',      'Strawberry Juice',  'soft','🍓', 2.50, '1 min', 95,  NULL, 'Sok od jagode.',                 'Strawberry juice.',           '0.2 l', 3140),
  ('sok_visnja',      'Sok od višnje',      'Sour Cherry Juice', 'soft','🍒', 2.50, '1 min', 100, NULL, 'Sok od višnje.',                 'Sour cherry juice.',          '0.2 l', 3150),
  ('sok_kajsija',     'Sok od kajsije',     'Apricot Juice',     'soft','🍑', 2.50, '1 min', 105, NULL, 'Sok od kajsije.',                'Apricot juice.',              '0.2 l', 3160),
  ('sok_borovnica',   'Sok od borovnice',   'Blueberry Juice',   'soft','🫐', 2.80, '1 min', 95,  NULL, 'Sok od borovnice.',              'Blueberry juice.',            '0.2 l', 3170),
  ('sok_ananas',      'Sok od ananasa',     'Pineapple Juice',   'soft','🍍', 2.80, '1 min', 106, NULL, 'Sok od ananasa.',                'Pineapple juice.',            '0.2 l', 3180),
  ('sok_brusnica',    'Sok od brusnice',    'Cranberry Juice',   'soft','🔴', 2.80, '1 min', 92,  NULL, 'Sok od brusnice.',               'Cranberry juice.',            '0.2 l', 3190),
  ('sok_multivitamin','Multivitamin sok',   'Multivitamin Juice','soft','🧃', 2.50, '1 min', 98,  NULL, 'Multivitaminski voćni sok.',     'Multivitamin fruit juice.',   '0.2 l', 3200),
  ('nektar_kruska',   'Nektar od kruške',   'Pear Nectar',       'soft','🍐', 2.50, '1 min', 110, NULL, 'Nektar od kruške.',              'Pear nectar.',                '0.2 l', 3210),
  ('sok_paradajz',    'Sok od paradajza',   'Tomato Juice',      'soft','🍅', 2.50, '1 min', 42,  NULL, 'Sok od paradajza.',              'Tomato juice.',               '0.2 l', 3220)
ON CONFLICT (id) DO NOTHING;

-- ─── GAZIRANA + NEGAZIRANA (dopuna postojećim) ───────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('pepsi',           'Pepsi 0.25',           'Pepsi 0.25',           'soft','🥤', 2.50, '1 min', 105, NULL, 'Gazirano osvježenje.',              'Cola soft drink.',            '0.25 l', 3310),
  ('schweppes_orange','Schweppes Orange',     'Schweppes Orange',     'soft','🍊', 2.80, '1 min', 100, NULL, 'Gazirano piće s ukusom pomorandže.','Orange sparkling drink.',     '0.25 l', 3320),
  ('guarana',         'Guarana 0.25',         'Guarana 0.25',         'soft','🟠', 2.50, '1 min', 120, NULL, 'Gazirano piće s ukusom guarane.',   'Guarana soft drink.',         '0.25 l', 3330),
  ('soda_voda',       'Soda voda 0.25',       'Soda Water 0.25',      'soft','💧', 1.50, '1 min', 0,   NULL, 'Gazirana soda voda.',               'Soda water.',                 '0.25 l', 3340),
  ('voda_05',         'Negazirana voda 0.5',  'Still Water 0.5',      'soft','💧', 2.00, '1 min', 0,   NULL, 'Negazirana izvorska voda.',         'Still spring water 0.5l.',    '0.5 l',  3350),
  ('voda_075',        'Voda 0.75 (sto)',      'Still Water 0.75',     'soft','💧', 2.80, '1 min', 0,   NULL, 'Negazirana voda za sto 0.75l.',     'Still water 0.75l (table).',  '0.75 l', 3360),
  ('kisela_05',       'Kisela voda 0.5',      'Sparkling Water 0.5',  'soft','💧', 2.20, '1 min', 0,   NULL, 'Gazirana mineralna voda 0.5l.',     'Sparkling mineral water 0.5l.','0.5 l', 3370)
ON CONFLICT (id) DO NOTHING;

-- ─── TOČENA BEZALKOHOLNA (fountain) ──────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('toceni_sok_naranca','Točeni sok naranča', 'Fountain Orange',  'soft','🍊', 2.20, '1 min', 90,  NULL, 'Točeno bezalkoholno piće s ukusom pomorandže.','Fountain orange drink.', '0.3 l', 3410),
  ('tocena_kola',       'Točena kola',        'Fountain Cola',    'soft','🥤', 2.20, '1 min', 120, NULL, 'Točena kola iz aparata.',                      'Fountain cola.',          '0.3 l', 3420),
  ('tocena_limunada',   'Točena limunada',    'Fountain Lemonade','soft','🍋', 2.20, '1 min', 85,  NULL, 'Točena limunada iz aparata.',                  'Fountain lemonade.',      '0.3 l', 3430)
ON CONFLICT (id) DO NOTHING;

-- ─── ČAJEVI (topli napici) ───────────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('caj_sumsko',      'Čaj od šumskog voća', 'Forest Fruit Tea',   'hot','🍵', 1.80, '3 min', 2, NULL, 'Topli čaj od šumskog voća.',          'Hot forest fruit tea.',     '0.2 l', 3510),
  ('caj_djumbir',     'Čaj od đumbira',      'Ginger Tea',         'hot','🫚', 2.00, '3 min', 4, NULL, 'Čaj od svježeg đumbira.',             'Fresh ginger tea.',         '0.2 l', 3520),
  ('caj_limun_med',   'Čaj limun i med',     'Lemon & Honey Tea',  'hot','🍯', 2.00, '3 min', 40,NULL, 'Topli čaj s limunom i medom.',        'Hot tea with lemon & honey.','0.2 l', 3530),
  ('caj_hibiskus',    'Čaj od hibiskusa',    'Hibiscus Tea',       'hot','🌺', 1.80, '3 min', 2, NULL, 'Aromatičan čaj od hibiskusa.',        'Aromatic hibiscus tea.',    '0.2 l', 3540),
  ('caj_jabuka_cimet','Čaj jabuka-cimet',    'Apple-Cinnamon Tea', 'hot','🍎', 1.80, '3 min', 3, NULL, 'Čaj jabuke i cimeta.',                'Apple-cinnamon tea.',       '0.2 l', 3550),
  ('bijeli_caj',      'Bijeli čaj',          'White Tea',          'hot','🍵', 2.00, '3 min', 1, NULL, 'Nježan bijeli čaj.',                  'Delicate white tea.',       '0.2 l', 3560),
  ('caj_rooibos',     'Rooibos čaj',         'Rooibos Tea',        'hot','🍵', 2.00, '3 min', 2, NULL, 'Rooibos čaj bez kofeina.',            'Caffeine-free rooibos tea.','0.2 l', 3570),
  ('planinski_caj',   'Planinski čaj',       'Mountain Tea',       'hot','🌿', 1.80, '3 min', 2, NULL, 'Čaj od planinskih trava.',            'Mountain herb tea.',        '0.2 l', 3580),
  ('caj_zalfija',     'Čaj od žalfije',      'Sage Tea',           'hot','🌿', 1.80, '3 min', 2, NULL, 'Čaj od žalfije.',                     'Sage tea.',                 '0.2 l', 3590)
ON CONFLICT (id) DO NOTHING;

-- ─── PIVA — balkanska flaširana ──────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('niksicko',        'Nikšićko pivo 0.5',   'Nikšićko Beer 0.5',     'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Crnogorsko svijetlo pivo (Nikšić).',     'Montenegrin lager (Nikšić).',    '0.5 l',  3610),
  ('niksicko_tamno',  'Nikšićko tamno 0.5',  'Nikšićko Dark 0.5',     'beverage','🍺', 2.70, '1 min', 250, 'Gluten', 'Crnogorsko tamno pivo.',                 'Montenegrin dark lager.',        '0.5 l',  3620),
  ('jelen',           'Jelen pivo 0.5',      'Jelen Beer 0.5',        'beverage','🍺', 2.50, '1 min', 215, 'Gluten', 'Srpsko svijetlo pivo.',                  'Serbian lager.',                 '0.5 l',  3630),
  ('lav',             'Lav pivo 0.5',        'Lav Beer 0.5',          'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Srpsko svijetlo pivo.',                  'Serbian lager.',                 '0.5 l',  3640),
  ('zajecarsko',      'Zaječarsko 0.5',      'Zaječarsko 0.5',        'beverage','🍺', 2.40, '1 min', 210, 'Gluten', 'Srpsko pivo.',                           'Serbian lager.',                 '0.5 l',  3650),
  ('ozujsko',         'Ožujsko 0.5',         'Ožujsko 0.5',           'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Hrvatsko svijetlo pivo.',                'Croatian lager.',                '0.5 l',  3660),
  ('karlovacko',      'Karlovačko 0.5',      'Karlovačko 0.5',        'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Hrvatsko svijetlo pivo.',                'Croatian lager.',                '0.5 l',  3670),
  ('sarajevsko',      'Sarajevsko 0.5',      'Sarajevsko 0.5',        'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Bosansko svijetlo pivo.',                'Bosnian lager.',                 '0.5 l',  3680),
  ('lasko',           'Laško 0.5',           'Laško 0.5',             'beverage','🍺', 2.60, '1 min', 210, 'Gluten', 'Slovenačko svijetlo pivo.',              'Slovenian lager.',               '0.5 l',  3690),
  ('union',           'Union 0.5',           'Union 0.5',             'beverage','🍺', 2.60, '1 min', 210, 'Gluten', 'Slovenačko svijetlo pivo.',              'Slovenian lager.',               '0.5 l',  3700),
  ('skopsko',         'Skopsko 0.5',         'Skopsko 0.5',           'beverage','🍺', 2.50, '1 min', 210, 'Gluten', 'Makedonsko svijetlo pivo.',              'Macedonian lager.',              '0.5 l',  3710)
ON CONFLICT (id) DO NOTHING;

-- ─── PIVA — internacionalna + specijalna ─────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('heineken',        'Heineken 0.33',       'Heineken 0.33',         'beverage','🍺', 3.00, '1 min', 140, 'Gluten', 'Holandsko svijetlo pivo.',               'Dutch lager.',                   '0.33 l', 3720),
  ('stella',          'Stella Artois 0.33',  'Stella Artois 0.33',    'beverage','🍺', 3.00, '1 min', 140, 'Gluten', 'Belgijsko svijetlo pivo.',               'Belgian lager.',                 '0.33 l', 3730),
  ('corona',          'Corona 0.33',         'Corona 0.33',           'beverage','🍺', 3.50, '1 min', 148, 'Gluten', 'Meksičko svijetlo pivo s limetom.',      'Mexican lager with lime.',       '0.33 l', 3740),
  ('tuborg',          'Tuborg 0.33',         'Tuborg 0.33',           'beverage','🍺', 2.80, '1 min', 140, 'Gluten', 'Dansko svijetlo pivo.',                  'Danish lager.',                  '0.33 l', 3750),
  ('guinness',        'Guinness 0.44',       'Guinness 0.44',         'beverage','🍺', 4.00, '1 min', 180, 'Gluten', 'Irsko tamno pivo (stout).',              'Irish stout.',                   '0.44 l', 3760),
  ('radler',          'Radler 0.5',          'Radler 0.5',            'beverage','🍺', 2.50, '1 min', 120, 'Gluten', 'Pivo s limunom, niži alkohol.',          'Beer with lemon, lower alcohol.','0.5 l',  3770),
  ('pivo_bezalk',     'Bezalkoholno pivo 0.5','Non-alcoholic Beer 0.5','beverage','🍺', 2.50, '1 min', 80,  'Gluten', 'Pivo bez alkohola.',                     'Non-alcoholic beer.',            '0.5 l',  3780)
ON CONFLICT (id) DO NOTHING;

-- ─── PIVA — točena ───────────────────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('toceno_03',       'Točeno pivo 0.3',     'Draft Beer 0.3',        'beverage','🍺', 1.80, '1 min', 126, 'Gluten', 'Točeno svijetlo pivo 0.3l.',             'Draft lager 0.3l.',              '0.3 l',  3810),
  ('toceno_tamno_05', 'Točeno tamno 0.5',    'Draft Dark 0.5',        'beverage','🍺', 2.80, '1 min', 250, 'Gluten', 'Točeno tamno pivo 0.5l.',                'Draft dark beer 0.5l.',          '0.5 l',  3820),
  ('toceni_radler_05','Točeni radler 0.5',   'Draft Radler 0.5',      'beverage','🍺', 2.50, '1 min', 120, 'Gluten', 'Točeni radler s limunom 0.5l.',          'Draft lemon radler 0.5l.',       '0.5 l',  3830)
ON CONFLICT (id) DO NOTHING;

-- ─── ŽESTOKO — balkanske rakije ──────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('sljivovica',     'Šljivovica',     'Plum Brandy (Šljivovica)','beverage','🥃', 2.50, '1 min', 70, NULL, 'Tradicionalna rakija od šljive.',        'Traditional plum brandy.',        '0.03 l', 3910),
  ('kajsijevaca',    'Kajsijevača',    'Apricot Brandy',          'beverage','🥃', 2.80, '1 min', 70, NULL, 'Rakija od kajsije.',                     'Apricot brandy.',                 '0.03 l', 3920),
  ('dunjevaca',      'Dunjevača',      'Quince Brandy',           'beverage','🥃', 2.80, '1 min', 70, NULL, 'Rakija od dunje.',                       'Quince brandy.',                  '0.03 l', 3930),
  ('visnjevaca',     'Višnjevača',     'Sour Cherry Brandy',      'beverage','🥃', 2.80, '1 min', 75, NULL, 'Rakija od višnje.',                      'Sour cherry brandy.',             '0.03 l', 3940),
  ('travarica',      'Travarica',      'Herbal Grappa',           'beverage','🥃', 2.50, '1 min', 70, NULL, 'Lozova rakija s primorskim travama.',    'Grape brandy with herbs.',        '0.03 l', 3950),
  ('medovaca',       'Medovača',       'Honey Brandy',            'beverage','🥃', 2.80, '1 min', 90, NULL, 'Rakija s medom.',                        'Honey brandy.',                   '0.03 l', 3960),
  ('klekovaca',      'Klekovača',      'Juniper Brandy',          'beverage','🥃', 2.80, '1 min', 70, NULL, 'Rakija od kleke (smreke).',              'Juniper brandy.',                 '0.03 l', 3970),
  ('komovica',       'Komovica',       'Pomace Brandy',           'beverage','🥃', 2.30, '1 min', 70, NULL, 'Rakija od komine grožđa.',               'Grape pomace brandy.',            '0.03 l', 3980),
  ('prepecenica',    'Prepečenica',    'Double-distilled Brandy', 'beverage','🥃', 2.80, '1 min', 80, NULL, 'Jaka dvostruko pečena rakija.',          'Strong double-distilled brandy.', '0.03 l', 3990)
ON CONFLICT (id) DO NOTHING;

-- ─── ŽESTOKO — ostala + aperitivi ────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('tekila_pice',  'Tekila',        'Tequila',        'beverage','🥃', 3.50, '1 min', 70,  NULL,      'Meksička tekila.',              'Mexican tequila.',          '0.03 l', 4010),
  ('rum_pice',     'Rum',           'Rum',            'beverage','🥃', 3.50, '1 min', 70,  NULL,      'Bijeli ili tamni rum.',         'White or dark rum.',        '0.03 l', 4020),
  ('jager',        'Jägermeister',  'Jägermeister',   'beverage','🥃', 3.00, '1 min', 100, NULL,      'Njemački biljni liker.',        'German herbal liqueur.',    '0.03 l', 4030),
  ('baileys',      'Baileys',       'Baileys',        'beverage','🥃', 3.50, '1 min', 130, 'Mlijeko', 'Irski krem liker.',             'Irish cream liqueur.',      '0.04 l', 4040),
  ('campari_pice', 'Campari',       'Campari',        'beverage','🥃', 3.50, '1 min', 110, NULL,      'Gorki italijanski aperitiv.',   'Bitter Italian aperitif.',  '0.04 l', 4050),
  ('aperol_pice',  'Aperol',        'Aperol',         'beverage','🥃', 3.50, '1 min', 90,  NULL,      'Italijanski aperitiv.',         'Italian aperitif.',         '0.04 l', 4060),
  ('martini_pice', 'Martini',       'Martini',        'beverage','🥂', 3.00, '1 min', 100, 'Sulfiti', 'Italijanski vermut.',           'Italian vermouth.',         '0.05 l', 4070)
ON CONFLICT (id) DO NOTHING;

-- ─── VINA — balkanska (čaša / flaša / vrč) ───────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('vranac_casa',   'Vranac (čaša)',        'Vranac (glass)',         'beverage','🍷', 2.80, '1 min', 125, 'Sulfiti', 'Crnogorsko crveno vino, punog tijela.', 'Montenegrin full-bodied red.',   '0.1 l',  4110),
  ('vranac_flasa',  'Vranac (flaša 0.75)',  'Vranac (bottle 0.75)',   'beverage','🍷', 16.00,'1 min', 625, 'Sulfiti', 'Boca crnogorskog Vranca.',              'Bottle of Montenegrin Vranac.',  '0.75 l', 4120),
  ('krstac_casa',   'Krstač (čaša)',        'Krstač (glass)',         'beverage','🥂', 2.80, '1 min', 120, 'Sulfiti', 'Crnogorsko bijelo vino.',               'Montenegrin white wine.',        '0.1 l',  4130),
  ('krstac_flasa',  'Krstač (flaša 0.75)',  'Krstač (bottle 0.75)',   'beverage','🥂', 15.00,'1 min', 600, 'Sulfiti', 'Boca crnogorskog Krstača.',             'Bottle of Montenegrin Krstač.',  '0.75 l', 4140),
  ('prokupac_casa', 'Prokupac (čaša)',      'Prokupac (glass)',       'beverage','🍷', 2.80, '1 min', 125, 'Sulfiti', 'Srpsko autohtono crveno vino.',         'Serbian indigenous red.',        '0.1 l',  4150),
  ('tamjanika_casa','Tamjanika (čaša)',     'Tamjanika (glass)',      'beverage','🥂', 2.80, '1 min', 120, 'Sulfiti', 'Srpsko aromatično bijelo vino.',        'Serbian aromatic white.',        '0.1 l',  4160),
  ('zilavka_casa',  'Žilavka (čaša)',       'Žilavka (glass)',        'beverage','🥂', 2.80, '1 min', 120, 'Sulfiti', 'Hercegovačko bijelo vino.',             'Herzegovinian white wine.',      '0.1 l',  4170),
  ('blatina_casa',  'Blatina (čaša)',       'Blatina (glass)',        'beverage','🍷', 2.80, '1 min', 125, 'Sulfiti', 'Hercegovačko crveno vino.',             'Herzegovinian red wine.',        '0.1 l',  4180),
  ('plavac_casa',   'Plavac mali (čaša)',   'Plavac Mali (glass)',    'beverage','🍷', 3.00, '1 min', 130, 'Sulfiti', 'Dalmatinsko crveno vino.',              'Dalmatian red wine.',            '0.1 l',  4190),
  ('grasevina_casa','Graševina (čaša)',     'Graševina (glass)',      'beverage','🥂', 2.80, '1 min', 120, 'Sulfiti', 'Slavonsko bijelo vino.',                'Slavonian white wine.',          '0.1 l',  4200),
  ('malvazija_casa','Malvazija (čaša)',     'Malvazija (glass)',      'beverage','🥂', 3.00, '1 min', 120, 'Sulfiti', 'Istarsko bijelo vino.',                 'Istrian white wine.',            '0.1 l',  4210),
  ('rose_casa',     'Rosé (čaša)',          'Rosé (glass)',           'beverage','🥂', 2.80, '1 min', 120, 'Sulfiti', 'Rosé vino.',                            'Rosé wine.',                     '0.1 l',  4220),
  ('pjenusac_casa', 'Pjenušac (čaša)',      'Sparkling Wine (glass)', 'beverage','🍾', 3.00, '1 min', 90,  'Sulfiti', 'Pjenušavo vino.',                       'Sparkling wine.',                '0.1 l',  4230),
  ('domace_bijelo', 'Domaće bijelo (vrč 1l)','House White (1l carafe)','beverage','🥂', 8.00, '1 min', 680, 'Sulfiti', 'Domaće bijelo vino — vrč 1l.',          'House white wine — 1l carafe.',  '1 l',    4240),
  ('domace_crno',   'Domaće crno (vrč 1l)', 'House Red (1l carafe)',  'beverage','🍷', 8.00, '1 min', 700, 'Sulfiti', 'Domaće crno vino — vrč 1l.',            'House red wine — 1l carafe.',    '1 l',    4250),
  ('bevanda',       'Bevanda (crno + voda)','Red Wine Spritzer',      'beverage','🍷', 2.50, '1 min', 90,  'Sulfiti', 'Crno vino s vodom.',                    'Red wine with water.',           '0.2 l',  4260),
  ('gemist',        'Gemišt (bijelo + soda)','White Wine Spritzer',   'beverage','🥂', 2.50, '1 min', 85,  'Sulfiti', 'Bijelo vino sa soda vodom.',            'White wine with soda water.',    '0.2 l',  4270)
ON CONFLICT (id) DO NOTHING;

-- ─── SUPE I ČORBE (dopuna) ───────────────────────────────────────────────────
INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, portion, sort_order) VALUES
  ('teleca_corba',   'Teleća čorba',          'Veal Chowder',          'soup','🍲', 3.50, '12 min', 220, 'Gluten',          'Teleća čorba s povrćem.',                'Veal chowder with vegetables.',     '300 ml', 4310),
  ('jagnjeca_corba', 'Jagnjeća čorba',        'Lamb Chowder',          'soup','🍲', 3.80, '12 min', 240, 'Gluten',          'Jagnjeća čorba s povrćem.',              'Lamb chowder with vegetables.',     '300 ml', 4320),
  ('corba_pasulj',   'Čorbasti pasulj',       'Bean Soup',             'soup','🍲', 3.00, '12 min', 250, NULL,              'Čorbasti pasulj s povrćem.',             'Brothy bean soup with vegetables.', '350 ml', 4330),
  ('pasulj_kobasica','Pasulj s kobasicom',    'Bean Stew with Sausage','soup','🍲', 4.00, '15 min', 360, NULL,              'Prebranac/pasulj s dimljenom kobasicom.','Bean stew with smoked sausage.',    '350 ml', 4340),
  ('krem_paradajz',  'Krem supa od paradajza','Cream of Tomato Soup',  'soup','🥣', 3.20, '10 min', 160, 'Mlijeko',         'Kremasta supa od paradajza.',            'Creamy tomato soup.',               '300 ml', 4350),
  ('krem_brokoli',   'Krem supa od brokolija','Cream of Broccoli Soup','soup','🥣', 3.40, '10 min', 170, 'Mlijeko',         'Kremasta supa od brokolija.',            'Creamy broccoli soup.',             '300 ml', 4360),
  ('minestrone',     'Minestrone',            'Minestrone',            'soup','🍲', 3.50, '12 min', 180, 'Gluten',          'Italijanska supa od povrća i tjestenine.','Italian vegetable & pasta soup.',  '350 ml', 4370),
  ('gulas_supa',     'Gulaš supa',            'Goulash Soup',          'soup','🍲', 4.00, '15 min', 300, NULL,              'Gusta gulaš supa s govedinom.',          'Hearty beef goulash soup.',         '350 ml', 4380),
  ('corba_skoljke',  'Čorba od školjki',      'Seafood Chowder',       'soup','🐚', 5.00, '15 min', 200, 'Mekušci',         'Riblja čorba s plodovima mora.',         'Seafood chowder.',                  '300 ml', 4390)
ON CONFLICT (id) DO NOTHING;
