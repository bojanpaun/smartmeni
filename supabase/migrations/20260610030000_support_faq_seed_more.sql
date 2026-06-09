-- ============================================================================
-- Seed FAQ (dopuna) — dodatna pitanja: front desk, domaćinstvo, spa, inventar,
-- HR, restoran, plaćanja, sajt, onboarding.
-- ----------------------------------------------------------------------------
-- Additivno i idempotentno: ubacuje SAMO pitanja kojih još nema (po tekstu
-- pitanja), pa se može pustiti i preko već popunjene baze bez dupliranja.
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published)
SELECT v.question, v.answer, v.category, v.sort_order, v.is_published
FROM (VALUES
  -- ── Rezervacije / Front desk ──
  ('Kako radim check-in i check-out?',
   'Front desk → izaberi rezervaciju → „Check-in" otvara folio i postavlja sobu na „Zauzeto"; „Check-out" zatvara folio (uz naplatu salda) i šalje sobu na čišćenje.',
   'rezervacije', 40, true),
  ('Kako da blokiram sobu (održavanje, čišćenje)?',
   'Sobe → izaberi sobu → promijeni status na „Održavanje" ili „Van prodaje". Blokirana soba se ne nudi u dostupnosti niti za online booking dok je ne vratiš na „Slobodno".',
   'rezervacije', 50, true),
  ('Kako gost rezerviše online?',
   'Preko javne Booking stranice (restby.me/vaš-slug/booking): bira datume i tip sobe, sistem provjerava dostupnost i cijenu i kreira rezervaciju/upit. Aktiviraš je u Hotel → Online booking.',
   'rezervacije', 60, true),

  -- ── Domaćinstvo ──
  ('Kako funkcioniše domaćinstvo (housekeeping)?',
   'Nakon check-outa soba automatski ide na status „Za čišćenje". Spremačice u Staff portalu (tab Domaćinstvo) vide listu i obilježavaju sobu kao očišćenu, čime se vraća u prodaju.',
   'housekeeping', 10, true),
  ('Kako noćni audit utiče na domaćinstvo?',
   'Noćni audit svake noći resetuje dnevne housekeeping statuse (npr. zauzete sobe ponovo traže obradu), tako da osoblje ujutru ima tačnu listu zadataka.',
   'housekeeping', 20, true),

  -- ── Spa ──
  ('Kako gost rezerviše spa tretman?',
   'Na javnoj spa stranici (restby.me/vaš-slug/spa) bira tretman, termin i (opciono) terapeuta. Rezervacija se pojavljuje u Spa modulu na potvrdu.',
   'spa', 10, true),
  ('Šta su spa paketi?',
   'Kombinacija smještaja i tretmana kao jedna ponuda (npr. „2 noći + masaža"). Gost ih bira kroz booking, a tretmani se vežu uz boravak i njegov folio.',
   'spa', 20, true),
  ('Kako se spa naplaćuje hotelskom, a kako vanjskom gostu?',
   'Hotelskom gostu završen tretman ide automatski na folio sobe. Vanjski (walk-in) gost plaća direktno na spa recepciji — bez hotelskog folija.',
   'spa', 30, true),

  -- ── Inventar ──
  ('Kako pratim zalihe?',
   'Inventar (Inventory Pro) → stavke zaliha sa trenutnim stanjem, ulazi/izlazi i upozorenja za nizak nivo. Radi i za restoran i za hotel (minibar, kuhinja, šank).',
   'inventar', 10, true),
  ('Šta su recepture i kako skidaju zalihe?',
   'Receptura veže menu stavku sa namirnicama koje troši. Kad se stavka proda, sistem automatski umanjuje zalihe sastojaka — bez ručnog otpisa.',
   'inventar', 20, true),
  ('Kako je minibar povezan sa zalihama i folijem?',
   'Minibar artikli se vode kao zalihe; zaduženje gosta za potrošeni minibar ide na njegov folio, a stanje minibara se umanjuje.',
   'inventar', 30, true),

  -- ── Osoblje / HR ──
  ('Kako da dodam zaposlenog i dam mu pristup?',
   'HR → Osoblje → „Dodaj". Uneseš podatke i rolu (recepcija, kuhinja, šank, domaćinstvo, menadžer…); zaposleni dobija pristup Staff portalu prilagođen toj roli.',
   'osoblje', 30, true),
  ('Kako se evidentira radno vrijeme (prisustvo)?',
   'Zaposleni u Staff portalu klikne „Dolazak/Odlazak" (clock in/out). Evidencija se vidi u HR → Dolasci i koristi se za obračun plata.',
   'osoblje', 40, true),
  ('Kako rade plate/zarade?',
   'HR Pro računa zaradu na osnovu satnice ili fiksne plate i evidentiranog prisustva. Zaposleni svoju zaradu vidi u Staff portalu (tab Zarada).',
   'osoblje', 50, true),

  -- ── Meni i narudžbe ──
  ('Kako da dodam ili izmijenim stavku menija?',
   'Meni → Uređivanje menija. Dodaješ kategorije i stavke (naziv, cijena, opis, slika, alergeni). Promjene su odmah vidljive gostima na QR meniju.',
   'meni', 30, true),
  ('Kako kuhinja i šank vide narudžbe?',
   'Kroz Staff portal (Kuhinja / Šank dashboard) narudžbe stižu uživo (realtime) i prati se status: nova → u pripremi → spremno.',
   'meni', 40, true),
  ('Šta su konobarski (waiter) zahtjevi?',
   'Gost u digitalnom meniju može pozvati konobara ili tražiti račun; zahtjev se realtime pojavljuje osoblju zaduženom za salu.',
   'meni', 50, true),

  -- ── Plaćanja ──
  ('Koje načine plaćanja platforma podržava?',
   'Online kartično preko apstrahovanih provajdera (Stripe/Monri) i gotovinu na recepciji. Pretplate na planove idu posebno (trenutno PayPal, u planu Monri).',
   'placanja', 20, true),
  ('Kako da refundiram naplatu?',
   'Na folju/transakciji koja je plaćena online — opcija „Refund". Gotovinske naplate se storniraju ručno na folju.',
   'placanja', 30, true),

  -- ── Ostalo ──
  ('Da li je platforma trenutno besplatna?',
   'Tokom beta perioda da — pristup modulima i addonima je otključan bez naplate. Cijene i naplata se uključuju izlaskom iz bete.',
   'ostalo', 40, true),
  ('Kako da uredim javni sajt hotela/restorana?',
   'Hotel → Sajt hotela, odnosno Meni → Sajt restorana. Tu se uređuju naslovna, galerija, opis i kontakt koje gosti vide na restby.me/vaš-slug.',
   'ostalo', 50, true),
  ('Gdje mijenjam logo, naziv i osnovne podatke?',
   'U postavkama naloga (Sistem → Postavke). Tu su brend boja, logo, kontakt i opšte informacije koje se koriste kroz cijelu aplikaciju i na javnim stranicama.',
   'ostalo', 60, true)
) AS v(question, answer, category, sort_order, is_published)
WHERE NOT EXISTS (
  SELECT 1 FROM support_faq sf WHERE sf.question = v.question
);
