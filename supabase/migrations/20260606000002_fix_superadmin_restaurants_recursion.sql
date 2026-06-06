-- HITNA POPRAVKA: RLS rekurzija restaurants <-> user_profiles
--
-- ZAŠTO: migracija 20260606000001 dodala je na restaurants politiku koja u USING
-- radi inline "EXISTS (SELECT 1 FROM user_profiles ...)". Ali user_profiles već ima
-- politiku "Vlasnik vidi profile osoblja" koja u svom USING referencira restaurants.
-- Time je nastao ciklus: SELECT na restaurants -> evaluacija user_profiles RLS ->
-- evaluacija restaurants RLS -> ... => Postgres javlja infinite recursion (HTTP 500
-- na user_profiles, restaurants, addon_catalog... — sve što dotakne lanac).
--
-- RJEŠENJE: superadmin provjeru izvlačimo u SECURITY DEFINER funkciju. Ona čita
-- user_profiles kao vlasnik (postgres), pa RLS na user_profiles SE NE evaluira
-- unutar funkcije => ciklus je prekinut. Politiku na restaurants prepravljamo da
-- zove tu funkciju umjesto inline subquery-ja.

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_superadmin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- Zamijeni rekurzivnu politiku iz 20260606000001 verzijom koja koristi funkciju
DROP POLICY IF EXISTS "Superadmin upravlja restoranima" ON public.restaurants;

CREATE POLICY "Superadmin upravlja restoranima"
  ON public.restaurants
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
