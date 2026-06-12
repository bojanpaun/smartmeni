-- ============================================================================
-- CONTENT_TRANSLATIONS — keš AI prevoda tenant-sadržaja (Faza 3, multilingvalno)
-- ----------------------------------------------------------------------------
-- Generički store za prevode slobodnog tenant-sadržaja (nazivi/opisi jela,
-- kategorije, opis objekta...) na 6 ciljnih jezika (en/sr/hr/sq/tr/ru). Izvor je
-- uvijek 'me' (primarni jezik aplikacije) — NE čuva se ovdje. Jedan red = prevod
-- jednog polja jednog entiteta na jedan jezik.
--
-- ZAŠTO zaseban store (a ne kolone name_sr/name_hr/... po tabeli): 6 jezika ×
-- više polja × više tabela = schema bloat; generički store skalira bez ALTER-a i
-- jednoobrazno pokriva sve entitete + admin override + invalidaciju po hash-u.
-- (Postojeće name_en/description_en kolone ostaju netaknute — backfill u en je
-- opcioni kasniji korak; store ih može nadjačati kao is_override='true'.)
--
-- TOK: admin sačuva jelo → frontend zove edge funkciju `translate-content` →
-- Claude Haiku prevede na 6 jezika → upsert ovdje (service_role, zaobilazi RLS).
-- source_hash = hash izvornog teksta; ako se izvor promijeni, prevod je "stale"
-- i re-prevodi se; is_override='true' (ručno uneseno) AI NIKAD ne pregazi.
-- GuestMenu/GuestApp čitaju prevod za aktivni jezik (anon SELECT), fallback na izvor.
-- Vidi memoriju [[project-i18n-multilingual]].
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,                       -- 'menu_item' | 'category' | 'restaurant' | ...
  entity_id     uuid NOT NULL,                        -- id reda u izvornoj tabeli
  field         text NOT NULL,                        -- 'name' | 'description' | ...
  lang          text NOT NULL,                        -- ciljni jezik (NIKAD 'me' — to je izvor)
  value         text NOT NULL,                        -- prevedeni tekst
  is_override   boolean NOT NULL DEFAULT false,        -- true = ručno uneseno; AI ne pregazi
  source_hash   text,                                  -- hash izvornog teksta (invalidacija)
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT content_translations_lang_not_me CHECK (lang <> 'me'),
  CONSTRAINT content_translations_uniq UNIQUE (restaurant_id, entity_type, entity_id, field, lang)
);

COMMENT ON TABLE public.content_translations IS
  'Keš AI prevoda tenant-sadržaja na 6 ciljnih jezika (en/sr/hr/sq/tr/ru). Izvor=me (ovdje se ne čuva). source_hash invalidira stale prevode; is_override štiti ručne. Piše edge funkcija translate-content (service_role).';

-- Brzo učitavanje svih prevoda jednog tenanta za jedan jezik (GuestMenu render).
CREATE INDEX IF NOT EXISTS idx_content_translations_lookup
  ON public.content_translations (restaurant_id, lang, entity_type);

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

-- Javno čitljivo (gost u meniju/Guest App-u bira jezik anonimno) — kao menu_items.
CREATE POLICY "Prevodi su javni"
  ON public.content_translations FOR SELECT
  USING (true);

-- Vlasnik tenanta upravlja svojim prevodima (admin override UI; defense-in-depth
-- uz edge funkciju koja piše kao service_role).
CREATE POLICY "Vlasnik upravlja prevodima"
  ON public.content_translations FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- Superadmin pun pristup (SECURITY DEFINER helper — konvencija, izbjegava recursion).
CREATE POLICY "Superadmin upravlja prevodima"
  ON public.content_translations FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- updated_at se osvježava na svaki UPDATE (reuse postojećeg helpera iz spa migracije).
CREATE TRIGGER content_translations_updated_at
  BEFORE UPDATE ON public.content_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL ON TABLE public.content_translations TO anon;
GRANT ALL ON TABLE public.content_translations TO authenticated;
GRANT ALL ON TABLE public.content_translations TO service_role;
