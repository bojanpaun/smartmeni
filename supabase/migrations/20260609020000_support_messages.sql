-- ============================================================================
-- Messaging Faza 2 — Support threadovi (admin ↔ superadmin, dvosmjerno = podrška)
-- ----------------------------------------------------------------------------
-- Admin (vlasnik) otvori konverzaciju (pitanje/problem); superadmin odgovara po
-- threadu. Nema zasebnog ticketinga — ovo JE podrška. Unread po strani preko
-- last_read_at timestampova. Realtime za live poruke.
-- ============================================================================

-- ── 1. Konverzacije ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_conversations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subject                 TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sender_role        TEXT,          -- ko je poslao zadnju poruku (za unread)
  admin_last_read_at      TIMESTAMPTZ,   -- dokle je admin pročitao
  superadmin_last_read_at TIMESTAMPTZ,   -- dokle je superadmin pročitao
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_conv_restaurant ON support_conversations(restaurant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON support_conversations(status, last_message_at DESC);

COMMENT ON TABLE support_conversations IS
  'Support thread između tenant admina i superadmina. Unread po strani = poruke '
  'suprotne strane novije od {admin|superadmin}_last_read_at.';

-- ── 2. Poruke (restaurant_id denormalizovan — pravilo + jednostavan RLS) ─────
CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('admin', 'superadmin')),
  sender_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_msg_conv ON support_messages(conversation_id, created_at);

-- ── 3. Trigger: osvježi last_message_at na konverzaciji ─────────────────────
CREATE OR REPLACE FUNCTION public.touch_support_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE support_conversations
     SET last_message_at = NEW.created_at,
         last_sender_role = NEW.sender_role
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_touch_support_conversation ON support_messages;
CREATE TRIGGER trg_touch_support_conversation
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_conversation();

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;

-- Konverzacije: vlasnik upravlja svojim; superadmin svima.
CREATE POLICY "Owner manages own conversations"
  ON support_conversations FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Superadmin manages all conversations"
  ON support_conversations FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Poruke: vlasnik čita svoje; vlasnik šalje samo kao 'admin'; superadmin sve.
CREATE POLICY "Owner reads own messages"
  ON support_messages FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Owner sends admin messages"
  ON support_messages FOR INSERT
  WITH CHECK (
    sender_role = 'admin'
    AND restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
  );

CREATE POLICY "Superadmin manages all messages"
  ON support_messages FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 5. Realtime ──────────────────────────────────────────────────────────────
ALTER TABLE support_conversations REPLICA IDENTITY FULL;
ALTER TABLE support_messages      REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
