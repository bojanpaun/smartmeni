-- ============================================================================
-- Biblioteka minibara — predefinisani artikli koje tenant uvozi u minibar_items
-- ----------------------------------------------------------------------------
-- Globalna tabela (obrazac recipe_library/spa_treatment_library). Uvoz je
-- multi-select: import_minibar_items(restaurant_id, ids[]).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.minibar_library (
  id              TEXT PRIMARY KEY,             -- slug
  name            TEXT NOT NULL,
  name_en         TEXT,
  category        TEXT NOT NULL DEFAULT 'drink', -- drink | alcohol | snack
  suggested_price NUMERIC(10,2),
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.minibar_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads minibar library"
  ON public.minibar_library FOR SELECT TO authenticated
  USING (is_active = true OR public.is_superadmin());

CREATE POLICY "Superadmin manages minibar library"
  ON public.minibar_library FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ─── Import RPC (multi-select) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.import_minibar_items(p_restaurant_id UUID, p_ids TEXT[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; v_imported INT := 0; v_skipped INT := 0;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = auth.uid() AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  FOR v IN SELECT * FROM public.minibar_library WHERE id = ANY(p_ids) AND is_active = true LOOP
    IF EXISTS (SELECT 1 FROM public.minibar_items
               WHERE restaurant_id = p_restaurant_id AND lower(name) = lower(v.name)) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    INSERT INTO public.minibar_items (restaurant_id, name, price, is_active)
    VALUES (p_restaurant_id, v.name, v.suggested_price, true);
    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
END; $$;

GRANT EXECUTE ON FUNCTION public.import_minibar_items(UUID, TEXT[]) TO authenticated;

-- ─── SEED ────────────────────────────────────────────────────────────────────
INSERT INTO public.minibar_library (id, name, name_en, category, suggested_price, sort_order) VALUES
  ('water_still',   'Voda negazirana 0.5',  'Still water 0.5L',     'drink',   2.0,  10),
  ('water_spark',   'Voda gazirana 0.5',    'Sparkling water 0.5L', 'drink',   2.0,  20),
  ('coca_cola',     'Coca-Cola 0.33',       'Coca-Cola 0.33L',      'drink',   3.0,  30),
  ('fanta',         'Fanta 0.33',           'Fanta 0.33L',          'drink',   3.0,  40),
  ('sprite',        'Sprite 0.33',          'Sprite 0.33L',         'drink',   3.0,  50),
  ('juice_orange',  'Sok od narandže 0.2',  'Orange juice 0.2L',    'drink',   3.0,  60),
  ('juice_apple',   'Sok od jabuke 0.2',    'Apple juice 0.2L',     'drink',   3.0,  70),
  ('ice_tea',       'Ledeni čaj 0.33',      'Iced tea 0.33L',       'drink',   3.0,  80),
  ('energy_drink',  'Energetsko piće',      'Energy drink',         'drink',   4.0,  90),
  ('beer_local',    'Domaće pivo 0.33',     'Local beer 0.33L',     'alcohol', 4.0, 100),
  ('beer_import',   'Strano pivo 0.33',     'Imported beer 0.33L',  'alcohol', 5.0, 110),
  ('wine_red_mini', 'Crveno vino (mini)',   'Red wine (mini)',      'alcohol', 7.0, 120),
  ('wine_white_mini','Bijelo vino (mini)',  'White wine (mini)',    'alcohol', 7.0, 130),
  ('prosecco_mini', 'Prosecco (mini)',      'Prosecco (mini)',      'alcohol', 9.0, 140),
  ('whisky_mini',   'Viski (mini)',         'Whisky (mini)',        'alcohol', 8.0, 150),
  ('vodka_mini',    'Votka (mini)',         'Vodka (mini)',         'alcohol', 8.0, 160),
  ('chips',         'Čips',                 'Potato chips',         'snack',   3.0, 170),
  ('peanuts',       'Kikiriki',             'Peanuts',              'snack',   2.5, 180),
  ('chocolate',     'Čokolada',             'Chocolate bar',        'snack',   3.0, 190),
  ('pretzels',      'Slani štapići',        'Pretzel sticks',       'snack',   2.5, 200)
ON CONFLICT (id) DO NOTHING;
