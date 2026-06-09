-- ============================================================================
-- Seed FAQ — osnovne funkcionalnosti i veze modula (početni sadržaj baze znanja)
-- ----------------------------------------------------------------------------
-- Idempotentno: ne dira ako već ima unosa (da ne dupla na re-run/prod).
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published)
SELECT * FROM (VALUES
  -- ── Rezervacije ──
  ('Kako da kreiram rezervaciju?',
   'Hotel → Rezervacije → „Nova rezervacija". Izaberi tip sobe/sobu, datume, gosta i cijenu. Rezervacije mogu stići i online (Booking stranica) kao „Upit" koji potvrđuješ na Front desku.',
   'rezervacije', 10, true),
  ('Šta znače statusi rezervacije?',
   'Upit = online zahtjev koji čeka potvrdu; Potvrđena = prihvaćena; Prijavljen = gost je na check-inu; Odjavljen = završen boravak; Otkazana i No-show su samoobjašnjivi.',
   'rezervacije', 20, true),
  ('Da li sistem sprječava dvostruku rezervaciju (overbooking)?',
   'Da. Provjera dostupnosti i kreiranje rezervacije provjeravaju zauzetost soba za izabrane datume i ne dozvoljavaju preklapanje.',
   'rezervacije', 30, true),

  -- ── Folio ──
  ('Šta je folio?',
   'Folio je račun boravka gosta — objedinjuje sve troškove: noćenja (soba), restoran, minibar, spa i ostalo. Otvara se automatski pri check-inu.',
   'folio', 10, true),
  ('Kako se noćenja naplaćuju na folio?',
   'Pri check-inu se na folio upišu room charge stavke za SVE noći boravka (cijena po noći). Tako se iznos na folju poklapa sa iznosom rezervacije i Front deskom.',
   'folio', 20, true),
  ('Šta radi noćni audit?',
   'Noćni audit (EOD) zatvara dan: osigurava room charge na folijima, resetuje housekeeping i pravi dnevni izvještaj (prihod po kategoriji, popunjenost, ADR). Pokreće se automatski svake noći ili ručno na /admin/hotel/night-audit.',
   'folio', 30, true),
  ('Šta je split folio?',
   'Više folija po jednoj rezervaciji (npr. „Glavni" + „Firma d.o.o."). Svaku stavku dodjeljuješ na određeni folio, a svaki se naplaćuje i štampa zasebno.',
   'folio', 40, true),
  ('Šta se dešava kad gost ode ranije?',
   'Zavisi od politike hotela (Hotel → Online booking → „Naplata pri ranom odlasku"): „samo odsjedene noći" skida neodsjedene noći sa folija, a „ukupno rezervisano" zadržava pun iznos.',
   'folio', 50, true),

  -- ── Meni i narudžbe ──
  ('Kako gosti vide meni?',
   'Skeniranjem QR koda dolaze na restby.me/vaš-slug — meni radi odmah u browseru, bez instalacije aplikacije.',
   'meni', 10, true),
  ('Kako narudžba sa menija ide na sobu (room service)?',
   'Hotelski gost naručuje kroz digitalni meni / Guest App i bira „na sobu"; narudžba se automatski veže za folio gosta i ulazi u saldo.',
   'meni', 20, true),

  -- ── Plaćanja ──
  ('Kako gost plaća folio?',
   'Na stranici folija: „Plati karticom" (online, ako je aktivan payment provider) ili gotovinom uz zatvaranje folija. Plaćanje umanjuje saldo.',
   'placanja', 10, true),

  -- ── Osoblje / HR ──
  ('Kako da pošaljem obavijest osoblju?',
   'Obavještenja → Oglasna tabla → „Nova obavijest". Osoblje je vidi na Početnoj u Staff portalu (i može je zatvoriti kad pročita).',
   'osoblje', 10, true),
  ('Kako osoblje pristupa svom portalu?',
   'Na restby.me/vaš-slug/staff, prijavom svojim nalogom. Tabovi zavise od role (kuhinja, šank, recepcija, domaćinstvo, HR…).',
   'osoblje', 20, true),

  -- ── Ostalo / veze modula ──
  ('Kako su povezani hotel i restoran modul?',
   'Dijele istu bazu gostiju, osoblja i zaliha. Minibar i restoranske narudžbe idu na hotelski folio. Operativni addoni (HR Pro, Inventar Pro, Analitika) rade za obje vertikale.',
   'ostalo', 10, true),
  ('Šta su addoni?',
   'Dijeljeni servisi koji rade i za restoran i za hotel (HR, Inventar, Analitika, Loyalty…). Aktiviraš samo ono što ti treba; svaki je iza svog gejta.',
   'ostalo', 20, true),
  ('Kako spa tretman dolazi na folio?',
   'Kad se spa tretman hotelskog gosta završi/naplati, automatski se dodaje kao stavka na folio gosta (spa → folio).',
   'ostalo', 30, true)
) AS v(question, answer, category, sort_order, is_published)
WHERE NOT EXISTS (SELECT 1 FROM support_faq);
