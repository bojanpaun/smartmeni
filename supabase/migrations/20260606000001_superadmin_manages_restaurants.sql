-- Superadmin RLS politika za tabelu restaurants
--
-- ZAŠTO: /superadmin panel mijenja plan, is_complimentary, trial/expiry i suspenziju
-- na restoranima koje superadmin NE posjeduje. Jedina postojeća write politika na
-- restaurants je "Vlasnik upravlja restoranom" (auth.uid() = user_id), pa je svaki
-- superadmin UPDATE tuđeg restorana RLS-om pogađao 0 redova. Postgres UPDATE bez
-- pogođenih redova ne vraća grešku, pa je UI prikazivao "Sačuvano!" iako se ništa
-- nije snimilo (vidljivo kao "reset" po reloadu).
--
-- Tabela subscriptions već ima ekvivalentnu "Superadmin reads all subscriptions"
-- FOR ALL politiku (20260528000001) — ovime usklađujemo restaurants.

CREATE POLICY "Superadmin upravlja restoranima"
  ON public.restaurants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_superadmin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_superadmin = true
    )
  );
