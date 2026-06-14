-- ============================================================================
-- platform_roadmap — pun spisak preostalih funkcionalnosti iz roadmapa, na
-- LAIČKOM jeziku (čitalac nije programer). Izvor: ⬜ faze u restbyme_hotel_roadmap.md
-- (izuzeti: interni tehnički dug i već izgrađeno — spa, staff portal). Dalje
-- superadmin uređuje kroz UI (/superadmin → Obavještenja → Šta razvijamo).
-- ============================================================================

-- Ukloni prethodni (kraći) set da izbjegnemo duplikate.
DELETE FROM public.platform_roadmap
 WHERE title IN ('Fiskalizacija računa (Crna Gora)', 'Online plaćanje rezervacija', 'Loyalty program', 'Channel manager');

INSERT INTO public.platform_roadmap (title, description, sort_order) VALUES
  ('Fiskalizacija računa (Crna Gora)', 'Povezivanje s poreskom upravom: fiskalni račun sa QR kodom, štampa i poreski izvještaji.', 10),
  ('Online plaćanje rezervacija',      'Gosti plaćaju hotelsku rezervaciju karticom direktno na vašoj stranici — bez provizije posrednika.', 20),
  ('Mobilna aplikacija',                'Vođenje objekta sa telefona — narudžbe, rezervacije i pregled prometa u aplikaciji za Android i iPhone.', 30),
  ('Loyalty program',                   'Nagrađivanje stalnih gostiju: bodovi, nivoi i posebne ponude, povezano sa narudžbama i računima.', 40),
  ('Inventar — dobavljači i inventura', 'Evidencija dobavljača, narudžbenice i popis zaliha (inventura) za precizniju kontrolu troškova.', 50),
  ('Automatske email kampanje',         'Automatski emailovi gostima: zahvalnica nakon boravka, čestitka za rođendan i ponude za povratak.', 60),
  ('Hotel — room service i grupe',      'Narudžbe na sobu (room service), grupne rezervacije i lista čekanja za hotele.', 70),
  ('HR — obuke i učinak',               'Obuke zaposlenih, ocjenjivanje učinka i čuvanje dokumenata osoblja na jednom mjestu.', 80),
  ('Channel manager',                   'Automatska sinhronizacija slobodnih termina i cijena sa Booking.com, Airbnb i drugim kanalima.', 90),
  ('Sale za događaje (konferencije)',   'Organizacija konferencija, sala i događaja sa ponudama za korporativne klijente.', 100),
  ('Izdavanje apartmana i vila',        'Nova vrsta biznisa — kratkoročni najam: kalendar jedinica, gosti, čišćenje, boravišna taksa i self check-in.', 110),
  ('Upravljanje više objekata',         'Jedan nalog za lanac objekata: zbirni pregled prometa, poređenje objekata i konsolidovani izvještaji.', 120),
  ('Privatnost i GDPR alati',           'Alati za zaštitu podataka gostiju: izvoz i brisanje podataka na zahtjev, u skladu sa GDPR-om.', 130)
ON CONFLICT DO NOTHING;
