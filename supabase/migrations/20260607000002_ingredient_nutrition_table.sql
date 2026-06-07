-- Trajna nutritivna referenca: sastojak → kcal/jedinica + alergeni (EU)
--
-- ZAŠTO: superadmin editor biblioteke treba „Preračunaj kalorije/alergene iz
-- sastojaka". Dosad je ta mapa postojala samo privremeno u migracijama
-- (20260606000010 / 0012). Ovdje je perzistiramo da je frontend može čitati.
-- Globalna referenca (kao addon_catalog) — bez restaurant_id.

CREATE TABLE IF NOT EXISTS public.recipe_ingredient_nutrition (
  nm        TEXT PRIMARY KEY,            -- lowercase naziv sastojka
  kcal      NUMERIC NOT NULL DEFAULT 0,  -- kcal po jedinici (ml/g/kom)
  allergens TEXT[]  NOT NULL DEFAULT '{}'
);

ALTER TABLE public.recipe_ingredient_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads ingredient nutrition"
  ON public.recipe_ingredient_nutrition FOR SELECT TO authenticated USING (true);

CREATE POLICY "Superadmin manages ingredient nutrition"
  ON public.recipe_ingredient_nutrition FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

INSERT INTO public.recipe_ingredient_nutrition (nm, kcal, allergens) VALUES
  ('kafa (espreso)',0,'{}'), ('voda',0,'{}'), ('mlijeko',0.64,ARRAY['Mlijeko']),
  ('čokoladni sirup',3.0,'{}'), ('karamel sirup',3.2,'{}'),
  ('sladoled (vanila)',140,ARRAY['Mlijeko','Jaja']), ('viski',2.5,'{}'),
  ('šlag',2.9,ARRAY['Mlijeko']), ('šećer',4.0,'{}'), ('led',0,'{}'),
  ('bijeli rum',2.3,'{}'), ('tamni rum',2.3,'{}'), ('tekila',2.3,'{}'),
  ('džin',2.3,'{}'), ('votka',2.3,'{}'), ('cachaça',2.3,'{}'),
  ('burbon',2.5,'{}'), ('ražani viski',2.5,'{}'), ('triple sec',3.0,'{}'),
  ('liker od kafe',3.3,'{}'), ('liker od breskve',2.5,'{}'), ('campari',2.5,'{}'),
  ('aperol',1.5,'{}'), ('crveni vermut',1.4,ARRAY['Sulfiti']), ('angostura biter',2.8,'{}'),
  ('prosecco',0.8,ARRAY['Sulfiti']), ('šampanjac',0.8,ARRAY['Sulfiti']),
  ('šećerni sirup',2.6,'{}'), ('grenadina',2.6,'{}'),
  ('orgeat sirup',2.6,ARRAY['Orašasti plodovi']),
  ('sok od limete',0.25,'{}'), ('sok od limuna',0.22,'{}'), ('sok od brusnice',0.46,'{}'),
  ('sok od ananasa',0.53,'{}'), ('sok od pomorandže',0.45,'{}'), ('sok od paradajza',0.17,'{}'),
  ('pire od breskve',0.50,'{}'), ('soda voda',0,'{}'), ('tonik',0.34,'{}'),
  ('cola',0.42,'{}'), ('đumbirovo pivo',0.40,'{}'), ('pavlaka',2.0,ARRAY['Mlijeko']),
  ('kokosovo mlijeko',2.3,'{}'), ('limeta',10,'{}'), ('menta (listići)',0,'{}'),
  ('bjelance',17,ARRAY['Jaja']), ('so',0,'{}'), ('tabasko',0,'{}'),
  ('vorčester sos',1.0,ARRAY['Riba']),
  ('čaj (kesica)',0,'{}'), ('čaj od nane (kesica)',0,'{}'), ('sirup od breskve',2.6,'{}'),
  ('jagode',0.32,'{}'), ('šumsko voće',0.45,'{}'), ('banana',90,'{}'),
  ('čokolada',5.5,ARRAY['Mlijeko']), ('kakao prah',3.7,'{}'),
  ('mljeveno meso',2.5,'{}'), ('svinjetina',2.6,'{}'), ('piletina',1.65,'{}'),
  ('slanina',5.4,'{}'), ('pršuta',2.5,'{}'), ('salama',4.5,'{}'),
  ('lignje',0.92,ARRAY['Mekušci']), ('jaje',70,ARRAY['Jaja']),
  ('sir',3.5,ARRAY['Mlijeko']), ('kačkavalj',3.6,ARRAY['Mlijeko']),
  ('mocarela',2.8,ARRAY['Mlijeko']), ('parmezan',4.0,ARRAY['Mlijeko']),
  ('feta sir',2.6,ARRAY['Mlijeko']), ('puter',7.2,ARRAY['Mlijeko']),
  ('krem sir',3.4,ARRAY['Mlijeko']), ('brašno',3.6,ARRAY['Gluten']),
  ('špageti',3.7,ARRAY['Gluten']), ('pirinač',3.6,'{}'), ('hljeb',2.6,ARRAY['Gluten']),
  ('lepinja',200,ARRAY['Gluten']), ('pecivo (burger)',250,ARRAY['Gluten']),
  ('kora za pitu',3.4,ARRAY['Gluten']), ('keks',4.8,ARRAY['Gluten','Mlijeko']),
  ('krompir',0.77,'{}'), ('pomfrit (smrznuti)',1.5,'{}'), ('paradajz',0.18,'{}'),
  ('pasata (paradajz)',0.30,'{}'), ('krastavac',0.15,'{}'), ('crveni luk',0.40,'{}'),
  ('bijeli luk',1.49,'{}'), ('paprika',0.27,'{}'), ('zelena salata',0.15,'{}'),
  ('maslina',1.15,'{}'), ('pečurke',0.22,'{}'), ('kupus',0.25,'{}'),
  ('bosiljak',0.23,'{}'), ('maslinovo ulje',8.84,'{}'), ('ulje',8.84,'{}'),
  ('majonez',6.80,ARRAY['Jaja']), ('nutela',5.39,ARRAY['Mlijeko','Orašasti plodovi']),
  ('orasi',6.54,ARRAY['Orašasti plodovi']), ('med',3.04,'{}'), ('džem',2.5,'{}'),
  ('voće (sezonsko)',0.50,'{}')
ON CONFLICT (nm) DO NOTHING;
