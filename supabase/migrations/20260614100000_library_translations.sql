-- ============================================================================
-- library_translations — AI prevodi GLOBALNIH superadmin biblioteka (Faza 4)
-- ----------------------------------------------------------------------------
-- Kurirane biblioteke (recipe_library / spa_treatment_library / minibar_library)
-- su GLOBALNE (bez restaurant_id) → ne mogu u tenant-scoped content_translations.
-- Ova tabela je ogledalo content_translations, ali bez restaurant_id: superadmin
-- prevede katalog JEDNOM (centralno), a admin u pickeru (RecipeLibraryPicker / spa /
-- minibar) vidi imena na svom jeziku panela. Prevodi se samo `name` (jedino što
-- pickeri prikazuju). Izvor = 'me' (kolona name u izvornoj tabeli, ovdje se ne čuva).
--
-- Piše edge `translate-content` (mod library:true, samo superadmin). source_hash
-- preskače nepromijenjeno; bez is_override (nema ručne korekcije biblioteka).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,   -- 'recipe_library' | 'spa_treatment_library' | 'minibar_library'
  entity_id     uuid NOT NULL,
  field         text NOT NULL,   -- 'name'
  lang          text NOT NULL,   -- ciljni jezik (NIKAD 'me')
  value         text NOT NULL,
  source_hash   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT library_translations_lang_not_me CHECK (lang <> 'me'),
  CONSTRAINT library_translations_uniq UNIQUE (entity_type, entity_id, field, lang)
);

COMMENT ON TABLE public.library_translations IS
  'Keš AI prevoda GLOBALNIH biblioteka (recipe/spa/minibar) na 6 jezika za admin picker. Bez restaurant_id (biblioteke su superadmin-globalne). Piše edge translate-content (library:true, superadmin).';

CREATE INDEX IF NOT EXISTS idx_library_translations_lookup
  ON public.library_translations (lang, entity_type);

ALTER TABLE public.library_translations ENABLE ROW LEVEL SECURITY;

-- Čitanje: svaki prijavljeni admin (picker je admin-only površina).
CREATE POLICY "Library prevodi čitljivi prijavljenima"
  ON public.library_translations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Pisanje: samo superadmin (kurira biblioteke). is_superadmin() helper — konvencija.
CREATE POLICY "Superadmin upravlja library prevodima"
  ON public.library_translations FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER library_translations_updated_at
  BEFORE UPDATE ON public.library_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
