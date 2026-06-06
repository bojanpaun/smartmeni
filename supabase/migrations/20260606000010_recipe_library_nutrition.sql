-- Alergeni, kalorije i vrijeme pripreme za biblioteku recepata
--
-- ZAŠTO: uvezene stavke da nose i te info. Ne preuzimaju se iz vanjske baze
-- (nepouzdano za pića) nego se IZVODE iz sastojaka koje već imamo:
--   • alergeni  = unija alergena sastojaka (EU pojmovi: Mlijeko, Jaja, Sulfiti, ...)
--   • kalorije  = Σ(količina × kcal_po_jedinici)  [PRIBLIŽNO]
--   • prep_time = standard po kategoriji
--
-- VAŽNO: kalorije su procjena, a alergeni polazna osnova — tenant je dužan
-- provjeriti/dopuniti (zakonska odgovornost o alergenima je na ugostitelju).

ALTER TABLE public.recipe_library ADD COLUMN IF NOT EXISTS allergens TEXT;
ALTER TABLE public.recipe_library ADD COLUMN IF NOT EXISTS calories  INTEGER;
ALTER TABLE public.recipe_library ADD COLUMN IF NOT EXISTS prep_time TEXT;

-- Referentna mapa sastojaka: kcal po jedinici (ml/g/kom) + alergeni (EU).
CREATE TEMP TABLE ing_map (nm TEXT PRIMARY KEY, kcal NUMERIC, allergens TEXT[]) ON COMMIT DROP;
INSERT INTO ing_map (nm, kcal, allergens) VALUES
  -- kafa
  ('kafa (espreso)',   0,    '{}'),
  ('voda',             0,    '{}'),
  ('mlijeko',          0.64, ARRAY['Mlijeko']),
  ('čokoladni sirup',  3.0,  '{}'),
  ('karamel sirup',    3.2,  '{}'),
  ('sladoled (vanila)',140,  ARRAY['Mlijeko','Jaja']),
  ('viski',            2.5,  '{}'),
  ('šlag',             2.9,  ARRAY['Mlijeko']),
  ('šećer',            4.0,  '{}'),
  ('led',              0,    '{}'),
  -- alkohol baza
  ('bijeli rum',       2.3,  '{}'),
  ('tamni rum',        2.3,  '{}'),
  ('tekila',           2.3,  '{}'),
  ('džin',             2.3,  '{}'),
  ('votka',            2.3,  '{}'),
  ('cachaça',          2.3,  '{}'),
  ('burbon',           2.5,  '{}'),
  ('ražani viski',     2.5,  '{}'),
  -- likeri / aperitivi / vino
  ('triple sec',       3.0,  '{}'),
  ('liker od kafe',    3.3,  '{}'),
  ('liker od breskve', 2.5,  '{}'),
  ('campari',          2.5,  '{}'),
  ('aperol',           1.5,  '{}'),
  ('crveni vermut',    1.4,  ARRAY['Sulfiti']),
  ('angostura biter',  2.8,  '{}'),
  ('prosecco',         0.8,  ARRAY['Sulfiti']),
  ('šampanjac',        0.8,  ARRAY['Sulfiti']),
  -- sirupi
  ('šećerni sirup',    2.6,  '{}'),
  ('grenadina',        2.6,  '{}'),
  ('orgeat sirup',     2.6,  ARRAY['Orašasti plodovi']),
  -- sokovi
  ('sok od limete',    0.25, '{}'),
  ('sok od limuna',    0.22, '{}'),
  ('sok od brusnice',  0.46, '{}'),
  ('sok od ananasa',   0.53, '{}'),
  ('sok od pomorandže',0.45, '{}'),
  ('sok od paradajza', 0.17, '{}'),
  ('pire od breskve',  0.50, '{}'),
  -- mikseri
  ('soda voda',        0,    '{}'),
  ('tonik',            0.34, '{}'),
  ('cola',             0.42, '{}'),
  ('đumbirovo pivo',   0.40, '{}'),
  -- mliječno
  ('pavlaka',          2.0,  ARRAY['Mlijeko']),
  ('kokosovo mlijeko', 2.3,  '{}'),
  -- ostalo
  ('limeta',           10,   '{}'),
  ('menta (listići)',  0,    '{}'),
  ('bjelance',         17,   ARRAY['Jaja']),
  ('so',               0,    '{}'),
  ('tabasko',          0,    '{}'),
  ('vorčester sos',    1.0,  ARRAY['Riba']);

-- Kalorije = Σ(količina × kcal/jedinica). Nepoznati sastojak → 0 (LEFT JOIN).
UPDATE public.recipe_library r SET calories = sub.kcal
FROM (
  SELECT ri.recipe_id, round(sum(ri.quantity * COALESCE(m.kcal, 0)))::int AS kcal
  FROM public.recipe_library_ingredients ri
  LEFT JOIN ing_map m ON lower(ri.ingredient_name) = m.nm
  GROUP BY ri.recipe_id
) sub
WHERE sub.recipe_id = r.id;

-- Alergeni = unija (distinct) alergena svih sastojaka recepta.
UPDATE public.recipe_library r SET allergens = sub.al
FROM (
  SELECT ri.recipe_id, string_agg(DISTINCT a, ', ' ORDER BY a) AS al
  FROM public.recipe_library_ingredients ri
  JOIN ing_map m ON lower(ri.ingredient_name) = m.nm
  CROSS JOIN LATERAL unnest(m.allergens) AS a
  GROUP BY ri.recipe_id
) sub
WHERE sub.recipe_id = r.id;

-- Vrijeme pripreme: standard po kategoriji.
UPDATE public.recipe_library
   SET prep_time = CASE category
                     WHEN 'coffee'   THEN '2 min'
                     WHEN 'cocktail' THEN '4 min'
                     ELSE '3 min'
                   END
 WHERE prep_time IS NULL;
