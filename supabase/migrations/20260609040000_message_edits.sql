-- ============================================================================
-- Editovanje poruka — edited_at marker na najavama i oglasnoj ploči osoblja
-- ----------------------------------------------------------------------------
-- Superadmin može izmijeniti objavljenu platform najavu; admin može izmijeniti
-- obavijest osoblja. edited_at != null → UI prikazuje „izmijenjeno".
-- Bez RLS izmjena (postojeće manage politike pokrivaju UPDATE).
-- ============================================================================

ALTER TABLE platform_announcements ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE staff_announcements    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN platform_announcements.edited_at IS 'Vrijeme zadnje izmjene (null = nije mijenjano) → UI „izmijenjeno".';
COMMENT ON COLUMN staff_announcements.edited_at IS 'Vrijeme zadnje izmjene (null = nije mijenjano) → UI „izmijenjeno".';
