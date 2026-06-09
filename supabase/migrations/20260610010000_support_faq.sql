-- ============================================================================
-- Support FAQ / Baza znanja — superadmin uređuje, admini pretražuju (self-service)
-- ----------------------------------------------------------------------------
-- Platform-global (kao platform_announcements — bez restaurant_id). Prikazuje se na
-- vrhu /admin/support; admin prvo traži odgovor, pa otvara ticket ako ne nađe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_faq (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'ostalo',  -- rezervacije|folio|meni|placanja|osoblje|ostalo
  sort_order    INT  NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_faq_category ON support_faq(category, sort_order);

COMMENT ON TABLE support_faq IS
  'Baza znanja / FAQ za podršku. Superadmin upravlja; admini čitaju objavljene unose '
  'na /admin/support (self-service prije otvaranja tiketa).';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE support_faq ENABLE ROW LEVEL SECURITY;

-- Superadmin puni pristup (CRUD).
CREATE POLICY "Superadmin manages support_faq"
  ON support_faq FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Svaki authenticated admin čita objavljene unose.
CREATE POLICY "Authenticated reads published faq"
  ON support_faq FOR SELECT
  TO authenticated
  USING (is_published = true);
