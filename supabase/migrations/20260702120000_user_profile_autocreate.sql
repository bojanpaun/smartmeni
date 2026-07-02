-- ============================================================================
-- Auto-kreiranje public.user_profiles reda za svakog auth korisnika.
--
-- ZAŠTO: registracija (email i OAuth) kreira SAMO auth.users; ništa u tracked
-- migracijama nije garantovalo profil red. Posljedica: per-korisnik UPDATE-ovi
-- (`checklist_dismissed`, `onboarding_checklist`, `dashboard_kpis`, MyAccount profil)
-- pogađaju 0 redova i TIHO se gube za korisnike bez profila — npr. „Početni koraci"
-- se ponovo pale na svaki refresh jer se ✕ (dismissed) nikad ne snimi.
--
-- Funkcija `handle_new_user` postoji na produkciji (legacy setup), ali NIJE bila u
-- migracijama (schema drift). Ova migracija je kodifikuje idempotentno i SIGURNO:
--   • CREATE OR REPLACE → zamjenjuje eventualnu prod verziju verzijom sa ON CONFLICT
--     DO NOTHING (pa čak i ako postoji drugi (legacy) trigger koji je zove, nema
--     duplicate-key greške pri signup-u);
--   • trigger `on_auth_user_created` (drop+create → tačno jedan ispravno vezan);
--   • backfill zatečenih korisnika bez profila (uklj. postojeće vlasnike s bug-om).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Kreira prazan public.user_profiles red za svakog novog auth.users korisnika. Bez ovoga per-korisnik podešavanja (checklist_dismissed, onboarding_checklist, dashboard_kpis, profil) se ne mogu snimiti — nema reda za UPDATE. ON CONFLICT DO NOTHING → sigurno i uz eventualni drugi legacy trigger.';

-- Invariant: svaki auth.users red ima odgovarajući public.user_profiles red.
-- (COMMENT ON TRIGGER se ne može postaviti — migracioni rol nije vlasnik auth.users;
--  „zašto" je dokumentovano u COMMENT-u na funkciji handle_new_user iznad.)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: svi zatečeni korisnici bez profila (registrovani prije ovog triggera,
-- uklj. one kojima se dismiss/KPI nikad nije snimao).
INSERT INTO public.user_profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL;
