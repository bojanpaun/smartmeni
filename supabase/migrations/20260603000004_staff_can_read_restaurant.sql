-- ================================================================
-- Dozvoli staff korisnicima da čitaju vlastiti restoran
--
-- Sve prethodne RLS politike na restaurants koriste user_id = auth.uid()
-- što je owner-only. Staff korisnici imaju drukčiji uid, pa SELECT
-- restauranta vraća null kada su authenticated (anon SELECT radi odvojeno).
-- ================================================================

CREATE POLICY "Staff can read their restaurant"
  ON restaurants FOR SELECT
  USING (
    id IN (
      SELECT restaurant_id FROM staff
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ================================================================
-- RPC: get_restaurant_rejection_messages
-- SECURITY DEFINER — sigurno vraća rejection_messages za restoran
-- bez obzira na RLS kontekst pozivatelja (anon ili staff)
-- ================================================================

CREATE OR REPLACE FUNCTION get_restaurant_rejection_messages(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages JSONB;
BEGIN
  SELECT rejection_messages INTO v_messages
  FROM restaurants
  WHERE id = p_restaurant_id;

  RETURN v_messages;
END;
$$;

-- Dozvoli pozivanje svima (anon i authenticated)
GRANT EXECUTE ON FUNCTION get_restaurant_rejection_messages(UUID) TO anon, authenticated;
