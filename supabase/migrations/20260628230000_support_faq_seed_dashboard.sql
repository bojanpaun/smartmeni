-- ============================================================================
-- FAQ dopuna — admin početna: traka „Šta želite da uradite?" + „Početni koraci"
-- (čestitka / ručno sakrij-vrati / automatski detektori). support_faq je
-- platform-global (RLS: superadmin manage / authenticated read published).
-- Migracija se izvršava jednom → plain INSERT (kao prethodni FAQ seed-ovi).
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published) VALUES
  ('Čemu služi traka „Šta želite da uradite?" na početnoj?',
   'To je brza pretraga zadataka na admin početnoj stranici. Ukucaš cilj (npr. „dodaj jelo" ili „nova rezervacija") i dobiješ prečicu koja te vodi tačno na taj ekran — ne moraš tražiti funkciju kroz module. Prikazuju se samo zadaci koji odgovaraju tvojim vertikalama, modulima i dozvolama.',
   'ostalo', 100, true),

  ('Šta su „Početni koraci" i kako da ih sakrijem ili vratim?',
   'Kartica „🚀 Početni koraci" te vodi kroz osnovno podešavanje naloga (logo, meni, kategorije, sobe, role i dozvole, recepture, spa usluge…). Većina koraka se označi automatski čim uradiš radnju (npr. dodaš jelo ili kreiraš rolu), a neki ručno — dugmetom „Označi kao završeno". Kad završiš sve, dobiješ čestitku. Karticu možeš sakriti znakom × u njenom uglu, a vratiti je linkom „🚀 Početni koraci" pored dugmeta „⚙️ Prilagodi" iznad KPI kartica.',
   'ostalo', 101, true),

  ('Zašto se neki početni korak ponovo pojavi pošto sam ga završio?',
   'Koraci koji se prate automatski računaju se iz stvarnih podataka na nalogu. Ako obrišeš sve što je korak detektovao (npr. sve stavke menija), korak se vrati kao neurađen. To je očekivano — kartica uvijek prikazuje stvarno stanje. Ručno označeni koraci ostaju završeni.',
   'ostalo', 102, true),

  ('(Superadmin) Kako da uredim zadatke i početne korake na početnoj tenanata?',
   'Na /superadmin/dashboard uređuješ obje trake: „Zadaci (traka)" i „Početni koraci". Za svaki unos postavljaš ikonu, naziv, putanju i vidljivost po modulu/vertikali/dozvoli. Za početne korake biraš i „Detekciju": ako izabereš npr. „Dodata bar 1 rola" ili „Napravljena bar 1 receptura", korak se kod tenanta označava automatski kad kreira taj zapis; ostavi „Ručno" za korake koje korisnik sam potvrđuje. Labele se prevode dugmetom 🌐.',
   'ostalo', 103, true);
