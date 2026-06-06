-- Standardizacija superadmin RLS politika na public.is_superadmin()
--
-- ZAŠTO: postojeće superadmin politike (20260528000001) koriste inline
-- "EXISTS (SELECT 1 FROM user_profiles ...)". To je isti obrazac koji je na
-- restaurants izazvao infinite recursion (vidi 20260606000002). Trenutno tu nema
-- ciklusa, ali je latentni rizik: čim neka politika na user_profiles referencira
-- subscriptions/addon_catalog, dobijamo 500. Prebacujemo ih na SECURITY DEFINER
-- funkciju public.is_superadmin() koja čita user_profiles zaobilazeći RLS.
--
-- KONVENCIJA: svaka NOVA superadmin RLS politika treba koristiti
-- public.is_superadmin() u USING/WITH CHECK — nikad inline EXISTS na user_profiles.

DROP POLICY IF EXISTS "Superadmin reads all subscriptions" ON public.subscriptions;
CREATE POLICY "Superadmin reads all subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin manages addon catalog" ON public.addon_catalog;
CREATE POLICY "Superadmin manages addon catalog"
  ON public.addon_catalog
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
