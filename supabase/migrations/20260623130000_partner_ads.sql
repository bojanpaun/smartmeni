-- ============================================================================
-- PARTNER_ADS — reklame partnera na javnom meniju (Faza 3 ponude)
-- ----------------------------------------------------------------------------
-- Banner reklame koje restoran prikazuje na svom javnom meniju (npr. partner/sponzor,
-- lokalni biznis, brend pića). Interni alat restorana — BEZ addon gatinga.
--
--   • placement gejtuje GDJE se banner pojavljuje u feedu: 'top' (poslije pretrage),
--     'middle' (poslije Ponude dana), 'bottom' (poslije liste artikala).
--   • is_active + valid_from/valid_until gejtuju prikaz (period kampanje).
--   • link_url (opciono) → klik otvara u novom tabu.
--   • title/subtitle su tenant-sadržaj → prevode se AI-jem (content_translations,
--     entity_type 'partner_ad'), čitaju kroz useContentTranslations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.partner_ads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title         text NOT NULL,
  subtitle      text,
  image_url     text,
  link_url      text,
  placement     text NOT NULL DEFAULT 'top',
  is_active     boolean NOT NULL DEFAULT true,
  valid_from    date,
  valid_until   date,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT partner_ads_placement_check CHECK (placement IN ('top','middle','bottom'))
);

COMMENT ON TABLE public.partner_ads IS
  'Banner reklame partnera na javnom meniju. placement (top/middle/bottom) bira poziciju u feedu; is_active + valid_from/until gejtuju prikaz. title/subtitle se prevode (content_translations, entity_type partner_ad).';

CREATE INDEX IF NOT EXISTS idx_partner_ads_restaurant ON public.partner_ads (restaurant_id);

ALTER TABLE public.partner_ads ENABLE ROW LEVEL SECURITY;

-- Vlasnik (i superadmin) puni CRUD nad svojim reklamama.
CREATE POLICY "Vlasnik upravlja reklamama"
  ON public.partner_ads FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

-- Aktivne reklame su javne (gost na meniju ih čita anon ključem) — kao menu_items.
CREATE POLICY "Aktivne reklame su javne"
  ON public.partner_ads FOR SELECT
  USING (is_active = true);

CREATE TRIGGER partner_ads_updated_at
  BEFORE UPDATE ON public.partner_ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL ON TABLE public.partner_ads TO anon;
GRANT ALL ON TABLE public.partner_ads TO authenticated;
GRANT ALL ON TABLE public.partner_ads TO service_role;
