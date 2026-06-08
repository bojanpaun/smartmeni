-- ============================================================================
-- Messaging Faza 1 — Platform najave (superadmin → admini, broadcast)
-- ----------------------------------------------------------------------------
-- Superadmin objavi najavu (npr. nova funkcija, održavanje); svi/filtrirani admini
-- je vide u inboxu + banner za važne (severity='important'). Jednosmjerno. Realtime
-- dostava novih najava. Platform-global tabela (kao addon_catalog/plans — bez
-- restaurant_id; nije tenant podatak).
--
-- Faza 2 (kasnije): platform_messages — dvosmjerni support threadovi admin↔superadmin.
-- ============================================================================

-- ── 1. Najave ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT,
  severity      TEXT NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info', 'update', 'important')),  -- important → banner
  audience      TEXT NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all', 'restaurant', 'hotel')),   -- filter po vertikali
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,                                          -- null = ne ističe
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_published
  ON platform_announcements(published_at DESC);

COMMENT ON TABLE platform_announcements IS
  'Platform najave superadmina adminima (broadcast). audience filtrira po vertikali; '
  'severity=important prikazuje banner u admin panelu. Realtime za live dostavu.';

-- ── 2. Pročitano (po adminu) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcement_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

COMMENT ON TABLE announcement_reads IS
  'Po-adminu evidencija pročitanih najava (za unread badge). user_id = auth.uid().';

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads     ENABLE ROW LEVEL SECURITY;

-- Najave: superadmin upravlja; svaki authenticated admin čita (broadcast, nije tajno).
CREATE POLICY "Superadmin manages announcements"
  ON platform_announcements FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Authenticated reads announcements"
  ON platform_announcements FOR SELECT
  TO authenticated
  USING (true);

-- Pročitano: korisnik upravlja samo svojim zapisima.
CREATE POLICY "User manages own reads"
  ON announcement_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 4. Realtime (live dostava novih najava) ─────────────────────────────────
ALTER TABLE platform_announcements REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE platform_announcements;
