-- ============================================================================
-- FAQ dopuna — fiskalizacija/računi, valuta i PDV, višejezičnost sadržaja, te
-- (za superadmina) prekidač odobrenja registracije. support_faq je platform-global
-- (RLS: superadmin manage / authenticated read published).
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published) VALUES
  ('Zaboravio sam da izdam račun — gdje ga sad nalazim?',
   'Računi se ne gube. Idi na Postavke → Fiskalizacija (/admin/settings/fiscalization). U sekciji „Za izdavanje" stoje sve servirane narudžbe, hotelske folije i spa termini koji još nemaju račun — klikni „Izdaj" pored stavke. Listi možeš pristupiti bilo kad, pa naknadno izdavanje uvijek radi.',
   'placanja', 30, true),

  ('Kako da uključim automatsko izdavanje računa?',
   'Na stranici Fiskalizacija uključi prekidač „Automatski izdaj račun na zatvaranje". Tada se račun za narudžbu kreira sam čim konobar zatvori narudžbu (odbijene narudžbe se preskaču). I dalje možeš ručno izdavati iz liste „Za izdavanje".',
   'placanja', 31, true),

  ('Kako da odštampam račun?',
   'Na stranici Fiskalizacija, u listi izdatih računa klikni na bilo koji račun — otvara se prikaz računa sa dugmetom „Štampaj". Štampa koristi standardni dijalog tvog pregledača (možeš i sačuvati kao PDF).',
   'placanja', 32, true),

  ('Kako se izdaje račun za hotel (folio) i spa?',
   'Isto kao za restoran: u sekciji „Za izdavanje" na stranici Fiskalizacija pojavljuju se i hotelske folije i spa termini bez računa. Klikom na „Izdaj" kreiraš račun za odabranu stavku, bez obzira na vertikalu.',
   'placanja', 33, true),

  ('Kako se računaju stope PDV-a i koja se primjenjuje?',
   'Svaka kategorija menija ima zadanu stopu PDV-a. Pojedinačno jelo ili spa usluga može imati svoju stopu koja nadjačava kategoriju. Račun automatski razdvaja osnovicu i PDV po svakoj stavci. Stope uređuje superadmin/podrška na nivou platforme.',
   'placanja', 34, true),

  ('Kako da promijenim valutu objekta?',
   'Valuta se postavlja po objektu i koristi je za sve iznose i račune (nema automatske konverzije između valuta). Ako ti treba promjena valute, obrati se podršci — mijenja se na nivou objekta jer utiče na sve cijene i račune.',
   'placanja', 35, true),

  ('Kako gosti vide meni na svom jeziku?',
   'Nazive i opise jela, kategorije i poruke unosiš na crnogorskom. Sadržaj se automatski prevodi na engleski, srpski, hrvatski, albanski, turski i ruski, a gostu se prikazuje prema jeziku koji izabere. Statični dijelovi aplikacije već su prevedeni.',
   'meni', 40, true),

  ('Prevod nekog jela nije dobar — mogu li ga ispraviti?',
   'Da. Pored stavke klikni 🌐 dugme, izaberi jezik i unesi svoj prevod. Tvoja ispravka se čuva kao „ručna" i automatski (AI) prevod je više neće pregaziti.',
   'meni', 41, true),

  ('(Superadmin) Kako da dozvolim registraciju bez mog odobrenja?',
   'Na /superadmin, na vrhu stranice je prekidač „Odobrenje registracije". Kada je uključen, svaki novi nalog čeka tvoje odobrenje prije aktivacije. Kada ga isključiš, novi nalozi se aktiviraju odmah po registraciji. Postojeća dugmad Odobri/Odbij i dalje rade za naloge na čekanju.',
   'ostalo', 90, true);
