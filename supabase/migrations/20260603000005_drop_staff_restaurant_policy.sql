-- ================================================================
-- HITNO: brisanje politike koja je uzrokovala RLS infinite loop
--
-- "Staff can read their restaurant" policy referencira staff tabelu.
-- staff tabela ima politiku koja referencira restaurants tabelu.
-- Rezultat: cirkularna referenca → 500 Internal Server Error na svim
-- Supabase REST upitima koji dodiruju restaurants ili staff.
--
-- Rjesenje: drop politike. Za rejection_messages koristimo
-- SECURITY DEFINER RPC get_restaurant_rejection_messages() koja
-- vec postoji i zaobilazi RLS bez cirkularne reference.
-- ================================================================

DROP POLICY IF EXISTS "Staff can read their restaurant" ON restaurants;
