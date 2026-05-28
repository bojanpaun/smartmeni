-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Auto-linking: kad se zaposlenik registruje, povezuje se sa staff rekordom

CREATE OR REPLACE FUNCTION public.link_staff_on_register()
RETURNS TRIGGER AS $$
BEGIN
  -- Kad novi korisnik kreira nalog, provjeri da li postoji staff rekord sa tim emailom
  UPDATE public.staff
  SET user_id = NEW.id
  WHERE email = LOWER(NEW.email)
    AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na auth.users tabeli
DROP TRIGGER IF EXISTS on_auth_user_created_link_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_link_staff
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_staff_on_register();

-- Retroaktivno poveži postojeće korisnike sa staff rekordom
-- (za korisnike koji su se registrovali prije nego je zaposlenik dodan)
UPDATE public.staff s
SET user_id = u.id
FROM auth.users u
WHERE LOWER(u.email) = LOWER(s.email)
  AND s.user_id IS NULL;
