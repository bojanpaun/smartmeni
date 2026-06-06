-- Storage RLS: superadmin upravlja objektima u bucketu 'recipe-library'
--
-- ZAŠTO: seeding skripta piše preko service_role (zaobilazi RLS), ali superadmin
-- UI (/superadmin/recipes) uploaduje slike iz browsera kao authenticated korisnik.
-- Bez ove politike upload bi RLS odbio. Read je javni (bucket public=true).

CREATE POLICY "Superadmin manages recipe-library objects"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'recipe-library' AND public.is_superadmin())
  WITH CHECK (bucket_id = 'recipe-library' AND public.is_superadmin());
