-- ============================================================================
-- Biblioteka tretmana — predefinisani spa tretmani koje tenant uvozi u katalog
-- ----------------------------------------------------------------------------
-- Isti obrazac kao recipe_library: globalna tabela (bez restaurant_id), superadmin
-- je puni/uređuje, tenant uvozi u svoj spa_services preko import_spa_treatment().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.spa_treatment_library (
  id                    TEXT PRIMARY KEY,            -- slug, npr. 'swedish_massage'
  name                  TEXT NOT NULL,               -- crnogorski → spa_services.name
  name_en               TEXT,
  category              TEXT NOT NULL DEFAULT 'massage', -- massage|facial|body|nail|wellness|group
  description           TEXT,
  description_en        TEXT,
  duration_minutes      INT NOT NULL DEFAULT 60,
  buffer_minutes        INT NOT NULL DEFAULT 15,
  suggested_price       NUMERIC(10,2),               -- predlog; tenant doradi
  price_couple          NUMERIC(10,2),
  requires_consultation BOOLEAN DEFAULT false,
  image_url             TEXT,
  sort_order            INT DEFAULT 0,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.spa_treatment_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads spa treatment library"
  ON public.spa_treatment_library FOR SELECT TO authenticated
  USING (is_active = true OR public.is_superadmin());

CREATE POLICY "Superadmin manages spa treatment library"
  ON public.spa_treatment_library FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ─── Import RPC: kopira tretman iz biblioteke u tenantov spa_services ─────────
CREATE OR REPLACE FUNCTION public.import_spa_treatment(p_restaurant_id UUID, p_treatment_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t RECORD; v_id UUID;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  SELECT * INTO v_t FROM public.spa_treatment_library WHERE id = p_treatment_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tretman nije pronađen: %', p_treatment_id; END IF;

  -- Idempotentno: ne dupliraj ako tretman istog imena već postoji
  IF EXISTS (SELECT 1 FROM public.spa_services
             WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v_t.name)) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_exists', 'name', v_t.name);
  END IF;

  INSERT INTO public.spa_services (
    restaurant_id, name, category, description, duration_minutes, buffer_minutes,
    price, price_couple, image_url, requires_consultation, is_active
  ) VALUES (
    p_restaurant_id, v_t.name, v_t.category, v_t.description, v_t.duration_minutes, v_t.buffer_minutes,
    COALESCE(v_t.suggested_price, 0), v_t.price_couple, v_t.image_url, v_t.requires_consultation, true
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'service_id', v_id, 'name', v_t.name);
END; $$;

GRANT EXECUTE ON FUNCTION public.import_spa_treatment(UUID, TEXT) TO authenticated;

-- ─── SEED: standardni tretmani ───────────────────────────────────────────────
INSERT INTO public.spa_treatment_library
  (id, name, name_en, category, description, duration_minutes, buffer_minutes, suggested_price, price_couple, requires_consultation, sort_order) VALUES
  ('swedish_massage',  'Švedska masaža',           'Swedish massage',      'massage',  'Opuštajuća masaža cijelog tijela srednjim pritiskom.', 60, 15, 45, 80, false, 10),
  ('deep_tissue',      'Deep tissue masaža',       'Deep tissue massage',  'massage',  'Duboka masaža za napetost i čvorove u mišićima.',      60, 15, 55, 100, false, 20),
  ('hot_stone',        'Masaža toplim kamenjem',   'Hot stone massage',    'massage',  'Masaža zagrijanim vulkanskim kamenjem.',               90, 15, 70, 130, false, 30),
  ('aromatherapy',     'Aromaterapijska masaža',   'Aromatherapy massage', 'massage',  'Masaža sa eteričnim uljima po izboru.',                60, 15, 50, 90, false, 40),
  ('back_neck',        'Masaža leđa i vrata',      'Back & neck massage',  'massage',  'Ciljana masaža gornjeg dijela tijela.',                30, 10, 30, NULL, false, 50),
  ('foot_massage',     'Masaža stopala',           'Foot massage',         'massage',  'Refleksološka masaža stopala.',                        30, 10, 28, NULL, false, 60),
  ('classic_facial',   'Klasični tretman lica',    'Classic facial',       'facial',   'Čišćenje, piling i hidratacija lica.',                 60, 15, 45, NULL, false, 70),
  ('antiage_facial',   'Anti-age tretman lica',    'Anti-aging facial',    'facial',   'Tretman protiv bora sa serumima.',                     75, 15, 65, NULL, true,  80),
  ('body_scrub',       'Piling tijela',            'Body scrub',           'body',     'Eksfolijacija i hidratacija cijelog tijela.',          45, 15, 40, NULL, false, 90),
  ('body_wrap',        'Oblog za tijelo',          'Body wrap',            'body',     'Detoksikacijski oblog (alga/glina).',                  60, 15, 55, NULL, false, 100),
  ('manicure',         'Manikir',                  'Manicure',             'nail',     'Njega noktiju ruku i lak.',                            45, 10, 25, NULL, false, 110),
  ('pedicure',         'Pedikir',                  'Pedicure',             'nail',     'Njega noktiju stopala i lak.',                         60, 10, 30, NULL, false, 120),
  ('sauna',            'Sauna',                    'Sauna session',        'wellness', 'Finska sauna — 30 minuta.',                            30, 0,  15, NULL, false, 130),
  ('hammam',           'Hammam ritual',            'Hammam ritual',        'wellness', 'Tradicionalni turski kupatilo ritual.',                60, 15, 50, NULL, false, 140),
  ('couples_massage',  'Masaža za parove',         'Couples massage',      'group',    'Masaža za dvoje u istoj kabini.',                      60, 15, 90, 90, false, 150),
  ('group_yoga',       'Grupna joga',              'Group yoga',           'group',    'Vođena joga sesija za grupu.',                         60, 0,  15, NULL, false, 160)
ON CONFLICT (id) DO NOTHING;
