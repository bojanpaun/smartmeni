-- Biblioteka: gazirana / flaširana bezalkoholna pića (kupljeni proizvodi)
-- Bez recepta/BOM-a (kao pivo/vino) — kalorije po standardnoj porciji, alergeni nema.
-- Kategorija 'soft' → tenant kategorija "Bezalkoholna".

INSERT INTO public.recipe_library
  (id, name, name_en, category, emoji, suggested_price, prep_time, calories, allergens, instructions, description_en, sort_order) VALUES
  ('cola',            'Coca-Cola 0.33',        'Coca-Cola 0.33',        'soft', '🥤', 2.50, '1 min', 139, NULL, 'Gazirano osvježenje 0.33l.',        'Soft drink 0.33l.',             300),
  ('cola_zero',       'Coca-Cola Zero 0.33',   'Coca-Cola Zero 0.33',   'soft', '🥤', 2.50, '1 min', 1,   NULL, 'Gazirano piće bez šećera 0.33l.',  'Sugar-free soft drink 0.33l.',  310),
  ('fanta',           'Fanta 0.33',            'Fanta 0.33',            'soft', '🍊', 2.50, '1 min', 150, NULL, 'Gazirano piće s ukusom pomorandže.','Orange soft drink 0.33l.',      320),
  ('sprite',          'Sprite 0.33',           'Sprite 0.33',           'soft', '🥤', 2.50, '1 min', 140, NULL, 'Gazirano piće s ukusom limete.',   'Lemon-lime soft drink 0.33l.',  330),
  ('bitter_lemon',    'Schweppes Bitter Lemon','Schweppes Bitter Lemon','soft', '🍋', 2.80, '1 min', 110, NULL, 'Gorko-limunsko gazirano piće.',    'Bitter lemon soft drink.',      340),
  ('tonik_pice',      'Schweppes Tonik',       'Schweppes Tonic',       'soft', '🥤', 2.80, '1 min', 90,  NULL, 'Tonik gazirano piće.',             'Tonic water.',                  350),
  ('cockta',          'Cockta 0.275',          'Cockta 0.275',          'soft', '🥤', 2.50, '1 min', 120, NULL, 'Domaće gazirano piće od šipka.',    'Regional cola-style soft drink.',360),
  ('red_bull',        'Red Bull 0.25',         'Red Bull 0.25',         'soft', '⚡', 4.00, '1 min', 115, NULL, 'Energetsko piće 0.25l.',           'Energy drink 0.25l.',           370),
  ('kisela_voda',     'Kisela voda 0.33',      'Sparkling Water 0.33',  'soft', '💧', 1.80, '1 min', 0,   NULL, 'Gazirana mineralna voda 0.33l.',   'Sparkling mineral water 0.33l.',380),
  ('negazirana_voda', 'Negazirana voda 0.33',  'Still Water 0.33',      'soft', '💧', 1.80, '1 min', 0,   NULL, 'Negazirana voda 0.33l.',           'Still water 0.33l.',            390)
ON CONFLICT (id) DO NOTHING;
