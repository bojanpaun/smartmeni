-- ============================================================================
-- FAQ dopuna — hardver i oprema (Faza 0): odgovori na česta tenant-pitanja
-- („koji printer", „treba li fiskalna kasa", „treba li instalacija/teren").
-- Cilj: prebaciti podršku sa terena na daljinu. Izvor: hardver_vodic.md.
-- support_faq je platform-global; migracija se izvršava jednom → plain INSERT.
-- ============================================================================

INSERT INTO support_faq (question, answer, category, sort_order, is_published) VALUES
  ('Koji hardver mi treba da koristim aplikaciju?',
   'Najmanje — uređaj sa modernim internet pretraživačem (telefon, tablet, laptop ili računar) i internet. Sve ostalo zavisi od veličine: mali objekat može startovati bez ijednog kupljenog uređaja (QR meni + naplata gotovinom/telefonom). Restoran sa kuhinjom obično dodaje termalni printer računa, kasa-fioku i tablet za kuhinju. Hotel dodaje printer i, po želji, čitač kartica i pametne brave. Nema potrebe za posebnim POS hardverom ni instalacijom na licu mjesta.',
   'ostalo', 110, true),

  ('Treba li mi fiskalna kasa (hardver)?',
   'Ne. Fiskalizacija se radi softverski/online — preko sertifikata i veze sa poreskom službom, direktno iz aplikacije. Nema potrebe za hardverskom fiskalnom kasom. Detalji i status po zemlji su u modulu Fiskalizacija (Postavke → Fiskalizacija).',
   'placanja', 111, true),

  ('Koji printer za račune da kupim?',
   'Preporučujemo termalni printer 80mm koji podržava „cloud" štampu (npr. Star mC-Print3 ili TSP143IV) — takav printer sam povlači račune sa našeg servera preko interneta, pa ga povežeš tako što u Postavkama upišeš njegov kod (bez instalacije programa). Na desktop računaru (Chrome/Edge) radi i običan USB termalni printer direktno iz pretraživača. Isti printer može da otvara i kasa-fioku (preko svog porta).',
   'placanja', 112, true),

  ('Kako da naplaćujem kartice?',
   'Dvije opcije za naplatu na licu mjesta: SoftPOS (plaćanje dodirom kartice na Android telefonu, bez posebnog uređaja) ili standalone terminal (bankarski/SumUp/myPOS) gdje sumu unosiš ručno. Online plaćanja (rezervacije, folio, web) već su u aplikaciji preko platnih provajdera — za to ne treba nikakav hardver.',
   'placanja', 113, true),

  ('Treba li mi poseban računar ili instalacija/tehničar?',
   'Ne. Aplikacija radi na bilo kom uređaju sa modernim pretraživačem — nema posebnog programa za instalaciju ni servera u lokalu. Možeš je „instalirati" kao aplikaciju na ekran (Windows/Android/iPhone) preko opcije pretraživača „Instaliraj aplikaciju". Podešavanje hardvera (printer, fioka) radiš sam iz Postavki; podrška ide na daljinu, bez izlaska na teren.',
   'ostalo', 114, true),

  ('Šta mi treba za hotel (recepcija, ključevi)?',
   'Za recepciju je dovoljan računar ili tablet sa pretraživačem. Printer računa/fakture je po želji (može dijeliti isti cloud printer sa restoranom). Ključevi: možeš ostati na fizičkim ključevima (nula opreme) ili koristiti pametne brave sa kodom/aplikacijom (TTLock/Igloohome/Nuki) za samostalnu prijavu gosta. Čitač ličnih dokumenata je opcion — ručni unos podataka gosta uvijek radi.',
   'rezervacije', 115, true);
