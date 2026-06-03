-- ================================================================
-- RPC get_restaurant_rejection_messages — SETOF TEXT
--
-- JSONB return type je bio nejasan za Supabase JS klijent.
-- SETOF TEXT vraca PostgREST kao cist JavaScript array of strings
-- bez ikakve ambigvitosti wrappinga.
-- SECURITY DEFINER zaobilazi sve RLS/GRANT probleme.
-- ================================================================

DROP FUNCTION IF EXISTS get_restaurant_rejection_messages(UUID);

CREATE OR REPLACE FUNCTION get_restaurant_rejection_messages(p_restaurant_id UUID)
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_array_elements_text(rejection_messages)
  FROM restaurants
  WHERE id = p_restaurant_id;
$$;

GRANT EXECUTE ON FUNCTION get_restaurant_rejection_messages(UUID) TO anon, authenticated;
