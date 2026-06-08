-- ============================================================================
-- Sigurnosni fix — staff_announcements cross-tenant curenje (Messaging Faza 3)
-- ----------------------------------------------------------------------------
-- Politika "staff_announcements_staff_read" je bila FOR SELECT TO authenticated
-- USING (true) → BILO KOJI ulogovani korisnik je mogao čitati interne obavijesti
-- osoblja SVIH tenanta. Sužavamo na osoblje tog restorana (isti šablon kao
-- "Staff reads rooms/hotel_reservations" iz hotel_core).
-- ============================================================================

DROP POLICY IF EXISTS "staff_announcements_staff_read" ON staff_announcements;

CREATE POLICY "staff_announcements_staff_read"
  ON staff_announcements FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Napomena: vlasnik i dalje ima pun pristup preko "staff_announcements_owner"
-- (FOR ALL, restaurant_id IN owner's restaurants).
