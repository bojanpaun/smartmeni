-- ============================================================================
-- MENU_BUNDLES + MENU_BUNDLE_ITEMS — paketi (combo) sa popustom za "Ponudu dana"
-- ----------------------------------------------------------------------------
-- Faza 2 ponude: "Ponuda dana" pored pojedinačnih artikala (is_special) sada može
-- biti i PAKET — grupa artikala koja u kompletu ima nižu cijenu.
--
--   • bundle_price = STVARNA naplaćena cijena paketa (izvor istine). Ušteda (€/%) se
--     RAČUNA u prikazu kao (zbir cijena artikala × količina) − bundle_price, iz AKTUELNIH
--     cijena u menu_items (uvijek svježa; ne čuvamo precrtanu cijenu). Admin u formi unosi
--     ili fiksnu cijenu ili % na zbir — frontend izvede bundle_price (vidi menuHelpers).
--   • is_active + valid_from/valid_until gejtuju prikaz na javnom meniju (period = "dana").
--   • menu_bundle_items.restaurant_id je DENORMALIZOVAN (pravilo: svaka tabela ima
--     restaurant_id za RLS; izbjegava join na menu_bundles u politici).
--   • Naziv/opis paketa su tenant-sadržaj → prevode se AI-jem (content_translations,
--     entity_type 'menu_bundle'), čitaju kroz useContentTranslations.
-- ============================================================================

-- ── menu_bundles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_bundles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  emoji         text DEFAULT '🎁',
  image_url     text,
  bundle_price  numeric(10,2) NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  valid_from    date,
  valid_until   date,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.menu_bundles IS
  'Paket (combo) artikala sa popustom za Ponudu dana. bundle_price = naplaćena cijena; ušteda se računa u prikazu vs zbir aktuelnih cijena artikala. is_active + valid_from/until gejtuju javni prikaz.';

CREATE INDEX IF NOT EXISTS idx_menu_bundles_restaurant ON public.menu_bundles (restaurant_id);

ALTER TABLE public.menu_bundles ENABLE ROW LEVEL SECURITY;

-- Vlasnik (i superadmin) puni CRUD nad svojim paketima.
CREATE POLICY "Vlasnik upravlja paketima"
  ON public.menu_bundles FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

-- Aktivni paketi su javni (gost na meniju ih čita anon ključem) — kao menu_items.
CREATE POLICY "Aktivni paketi su javni"
  ON public.menu_bundles FOR SELECT
  USING (is_active = true);

CREATE TRIGGER menu_bundles_updated_at
  BEFORE UPDATE ON public.menu_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL ON TABLE public.menu_bundles TO anon;
GRANT ALL ON TABLE public.menu_bundles TO authenticated;
GRANT ALL ON TABLE public.menu_bundles TO service_role;

-- ── menu_bundle_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_bundle_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id     uuid NOT NULL REFERENCES public.menu_bundles(id) ON DELETE CASCADE,
  menu_item_id  uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  quantity      integer NOT NULL DEFAULT 1,
  created_at    timestamptz DEFAULT now()
);

COMMENT ON TABLE public.menu_bundle_items IS
  'Stavke paketa (menu_item + količina). restaurant_id denormalizovan zbog RLS. Brisanje paketa/artikla kaskadno briše stavku.';

CREATE INDEX IF NOT EXISTS idx_menu_bundle_items_bundle ON public.menu_bundle_items (bundle_id);
CREATE INDEX IF NOT EXISTS idx_menu_bundle_items_restaurant ON public.menu_bundle_items (restaurant_id);

ALTER TABLE public.menu_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja stavkama paketa"
  ON public.menu_bundle_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

-- Stavke aktivnih paketa su javne (gost vidi šta paket sadrži).
CREATE POLICY "Stavke aktivnih paketa su javne"
  ON public.menu_bundle_items FOR SELECT
  USING (bundle_id IN (SELECT id FROM public.menu_bundles WHERE is_active = true));

GRANT ALL ON TABLE public.menu_bundle_items TO anon;
GRANT ALL ON TABLE public.menu_bundle_items TO authenticated;
GRANT ALL ON TABLE public.menu_bundle_items TO service_role;
