-- ============================================================================
-- Faza N — Doručak kontrola  [dio hotel_core]
-- ----------------------------------------------------------------------------
-- Sobe s uključenim doručkom (rate_plans.breakfast_included) imaju planirani
-- doručak po danu boravka. Recepcioner/konobar potvrđuje konzumaciju po sobi;
-- dnevni pregled prikazuje planirano vs iskorišteno (neiskorišteni = zloupotreba/
-- ušteda, vidljivi u F&B pregledu).
-- ============================================================================

-- ── 1. Flag na rate planu ────────────────────────────────────────────────────
ALTER TABLE rate_plans ADD COLUMN IF NOT EXISTS breakfast_included BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN rate_plans.breakfast_included IS
  'Rate plan uključuje doručak — rezervacije na ovom planu imaju planirani doručak '
  'po danu boravka (evidencija konzumacije: breakfast_log).';

-- ── 2. Evidencija konzumacije doručka ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS breakfast_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  reservation_id  UUID NOT NULL REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  persons         INT NOT NULL DEFAULT 1,
  recorded_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotencija: jedna potvrda doručka po rezervaciji po danu
  UNIQUE (reservation_id, date)
);

CREATE INDEX IF NOT EXISTS idx_breakfast_log_restaurant_date
  ON breakfast_log(restaurant_id, date);

COMMENT ON TABLE breakfast_log IS
  'Potvrđena konzumacija uključenog doručka po rezervaciji/danu. '
  'UNIQUE(reservation_id, date) sprječava dvostruku evidenciju.';

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE breakfast_log ENABLE ROW LEVEL SECURITY;

-- Vlasnik puni pristup
CREATE POLICY "Owner manages breakfast_log"
  ON breakfast_log FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Aktivni staff potvrđuje doručak (recepcija/konobar)
CREATE POLICY "Staff manages breakfast_log"
  ON breakfast_log FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- Superadmin (podrška)
CREATE POLICY "Superadmin manages breakfast_log"
  ON breakfast_log FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
