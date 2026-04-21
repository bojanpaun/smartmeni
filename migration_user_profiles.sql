-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Migracija: proširenje user_profiles za Moj nalog

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS viber TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Storage bucket za avatare
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies za avatare
DROP POLICY IF EXISTS "Avatari su javni" ON storage.objects;
CREATE POLICY "Avatari su javni"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Korisnik uploaduje vlastiti avatar" ON storage.objects;
CREATE POLICY "Korisnik uploaduje vlastiti avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Korisnik briše vlastiti avatar" ON storage.objects;
CREATE POLICY "Korisnik briše vlastiti avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policy za čitanje profila (korisnik vidi vlastiti + vlasnik vidi svoje zaposlenike)
DROP POLICY IF EXISTS "Vlasnik vidi profile osoblja" ON user_profiles;
CREATE POLICY "Vlasnik vidi profile osoblja"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT user_id FROM staff
      WHERE restaurant_id IN (
        SELECT id FROM restaurants WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE user_profiles IS 'Prošireni profili korisnika — ime, kontakt, avatar';
