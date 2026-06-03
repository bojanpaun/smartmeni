-- ================================================================
-- Fix: get_restaurant_rejection_messages — TEXT[] → JSONB konverzija
--
-- rejection_messages kolona je vjerovatno TEXT[] tip.
-- Prethodna verzija koristila je plpgsql DECLARE v_messages JSONB
-- koji ne može primiti TEXT[] bez eksplicitnog casta → tiho vraća null.
-- Nova verzija koristi TO_JSONB() koji radi i za TEXT[] i za JSONB.
-- ================================================================

CREATE OR REPLACE FUNCTION get_restaurant_rejection_messages(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TO_JSONB(rejection_messages)
  FROM restaurants
  WHERE id = p_restaurant_id;
$$;

GRANT EXECUTE ON FUNCTION get_restaurant_rejection_messages(UUID) TO anon, authenticated;
