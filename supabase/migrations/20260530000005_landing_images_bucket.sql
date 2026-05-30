-- ============================================================
-- Faza Y.1 — Supabase Storage bucket za slike landing stranica
-- ============================================================

-- Kreiraj javni bucket za landing page slike (max 5MB po fajlu)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'landing-images',
  'landing-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Javno čitanje (slike su na javnim stranicama)
CREATE POLICY "landing_images_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'landing-images');

-- Autentifikovani korisnici mogu uploadati
CREATE POLICY "landing_images_auth_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'landing-images');

-- Autentifikovani korisnici mogu brisati
CREATE POLICY "landing_images_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'landing-images');
