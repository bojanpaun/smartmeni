-- ================================================================
-- Eksplicitan GRANT za rejection_messages (JSONB kolona)
-- Kolona je JSONB tip — potvrdjeno greskom pri pokusaju TEXT[] funkcije.
-- ================================================================

GRANT SELECT(rejection_messages) ON restaurants TO anon;
GRANT SELECT(rejection_messages) ON restaurants TO authenticated;

-- Recreate RPC sa ispravnim tipovima (JSONB in, JSONB out)
DROP FUNCTION IF EXISTS get_restaurant_rejection_messages(UUID);

CREATE OR REPLACE FUNCTION get_restaurant_rejection_messages(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rejection_messages FROM restaurants WHERE id = p_restaurant_id;
$$;

GRANT EXECUTE ON FUNCTION get_restaurant_rejection_messages(UUID) TO anon, authenticated;
