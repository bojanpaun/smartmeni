# Hotel informacioni sistem — Funkcionalna specifikacija

**Ver. 2.0 | 2025 | 11 oblasti | Wellness+Hotel | API-first | Povjerljivo**

---

Sveobuhvatna arhitektura svih poslovnih oblasti

---

## Namjena dokumenta

Dokument definise funkcionalne zahtjeve, podatkovne entitete, integracijske tacke i arhitekturne preporuke za sveobuhvatni hotelski informacioni sistem koji obuhvata svih 11 poslovnih oblasti — ukljucujuci Wellness i Spa kao punopravni integrisani modul.

Namijenjen je IT arhitektima, projektnim menadzerima, poslovnim analitičarima i menadzerima odjela koji procjenjuju mogucnosti nadogradnje ili zamjene postojeceg IS-a.

---

# 1. Uvod i svrha dokumenta

Moderni hotel predstavlja slozen poslovni sistem s vise medusobno zavisnih operativnih oblasti. Svaka oblast generise podatke koje koriste ostale — gost koji rezervise sobu istovremeno postaje potencijalni korisnik spa centra, restorana i konferencijskog prostora. Fragmentiran pristup IS-u (vise zasebnih, nepovezanih sistema) dovodi do duplikacije podataka, manualne razmjene informacija i nemogucnosti holostičkog pogleda na gosta i prihode.

## 1.1 Ciljevi dokumenta

- Definisati funkcionalne zahtjeve za svaku od 11 poslovnih oblasti
- Opisati podatkovne entitete i njihove medusobne zavisnosti
- Predloziti integracijsku arhitekturu koja omogucava postepenu nadogradnju
- Identificirati prioritete implementacije i integracijske tacke s postojecim IS-om
- Posluziti kao osnova za RFP (zahtjev za ponudu) ili internu razvojnu specifikaciju

## 1.2 Obuhvat sistema

| Oblast | Modul | Tip korisnika |
|--------|-------|---------------|
| Smještaj i front office | PMS, rezervacije, housekeeping | Gost, recepcioner |
| Hrana i piće | Restoran, bar, room service, banket | Gost, konobar, kuhar |
| Finansije | Folio, racunovodstvo, kontroling | Finans. tim, management |
| Prodaja i marketing | CRM, loyalty, distribucija | Komercijalni tim, gost |
| Konferencije i MICE | Sale, eventi, BEO | Event menadzer, klijent |
| Wellness i Spa | Tretmani, terapeuti, retail | Gost, ext. klijent, terapeut |
| Ljudski resursi | Zaposleni, plate, obuka | HR, menadzer, zaposleni |
| Tehnicko odrzavanje | Kvarovi, preventiva, energetika | Tehnicki tim |
| Nabavka i zalihe | Dobavljaci, PO, zalihe | Nabavni tim |
| IT i integracije | API, sigurnost, backup | IT tim |
| BI i izvjestavanje | KPI, analitika, forecasting | Management, svi direktori |

---

# 2. Korisnici i korisnicke uloge

Sistem opsluzuje dvije kategorije krajnjih korisnika (gosti i posjetioci) i vise interno-operativnih uloga. Svaka uloga ima definisan skup modula kojima moze pristupiti.

## 2.1 Kategorije gostiju

| Atribut | Hotelski gost | Eksterni posjetilac | Korporativni klijent |
|---------|---------------|---------------------|----------------------|
| Identifikacija | Br. rezervacije/sobe | CRM profil/clan. kartica | Ugovorni ID/firma |
| Pristup uslugama | Sobe, F&B, spa, konf. | Spa, restoran, konf. | Grupe, MICE, F&B |
| Naplata | Folio (soba) ili direktno | Kartica/gotovina | Faktura/ugovor |
| Popust | Hotelska tarifa | Loyalty/sezonski | Ugovorena cijena |
| Marketing kanal | Hotel CRM | Direktni/spa CRM | Key account menadzer |
| GDPR status | Puno pristajanje | Pristajanje pri reg. | Poslovni ugovor |

## 2.2 Interne uloge i pristup

| Uloga | Opis pristupa | Kljucni moduli |
|-------|---------------|----------------|
| Generalni menadzer | Puni pristup — svi moduli i izvjestaji | Svi |
| Front Office menadzer | Rezervacije, check-in/out, folio, gosti | PMS, CRM, Fin. |
| Finansijski kontrolor | Prihodi, troskovi, budzetiranje, PDV | Fin., BI, Nabavka |
| F&B menadzer | Restoran, bar, kuhinja, banket | F&B, POS, Zalihe |
| Spa menadzer | Tretmani, terapeuti, spa CRM, KPI | Spa, HR, Fin. |
| Konferencijski coord. | Sale, eventi, BEO dokumentacija | MICE, F&B, Fin. |
| HR menadzer | Zaposleni, plate, obuka, performanse | HR, Fin. |
| IT administrator | Integracije, sigurnost, pristup | IT, svi API |
| Recepcioner | Check-in/out, rezervacije, info | PMS, CRM, Fin. |
| Terapeut | Raspored, profil klijenta, checklist | Spa booking |
| Tehnicar | Radni nalozi, odrzavanje | Odrzavanje |
| Konobar/sobar | POS narudzbe, status sobe | F&B POS, Housekeeping |

---

# 3. Modul 1 — Smještaj i front office (PMS)

Jezgro hotelskog IS-a. Svi ostali moduli zavise od PMS-a kao izvora informacija o gostu, sobi i periodu boravka. Kvalitet integracije ovog modula direktno utice na efikasnost svih ostalih funkcija.

## 3.1 Funkcionalni zahtjevi

**Rezervacije i distribucija**

- Multi-kanal booking — direktni web, OTA (Booking.com, Expedia), GDS, telefonski, šalter
- Channel manager integracija — real-time sinhronizacija dostupnosti i cijena na svim kanalima
- Yield management — automatska prilagodba cijena prema popunjenosti, datumu i segmentu
- Grupne rezervacije — blokiranje soba za grupe s pracenjem pickup-a i rooming liste
- Waitlista — automatska ponuda slobodnih soba pri otkazivanju
- Politika otkazivanja — definisanje i automatska primjena naknade

**Front office operacije**

- Check-in/check-out — brzi, mobilni i self-service kiosk opcija
- Dodjela soba — automatska ili rucna, uvazavanje preferencija gosta i statusa sobe
- Housekeeping status — real-time status ciscenja i inspekcije svake sobe
- Gostinska knjiga — profil gosta s historijom boravaka i preferencijama
- Nocni audit — automatski EOD zatvaranje s generisanjem financijskih izvjestaja
- Upravljanje kljucevima/karticama — enkodiranje kartice vezano za period boravka

## 3.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Rezervacija | ID, gost_id, tip_sobe, datum_od, datum_do, kanal, status, cijena, br_osoba |
| Soba | ID, broj, tip, kat, status (slobodna│zauzeta│ciscenje│inspekcija), max_osoba |
| Gost | ID, ime, prezime, email, tel, drzavljanstvo, dokument_br, loyalty_id, GDPR |
| Folio | ID, rez_id, stavke[], ukupno, status (otvoren│zatvoren│prenesen) |
| Cjenovnik | ID, tip_sobe, datum_od, datum_do, cijena, kanal, min_nocenja |

## 3.3 Integracije

- **OTA** — dvosmjerna API integracija za dostupnost, rezervacije i otkazivanja
- **GDS** — HTNG/XML integracija za korporativne i agencijske rezervacije
- **Payment gateway** — tokenizacija kartice pri rezervaciji, naplata pri check-out
- **Ostali moduli** — PMS je master source za gost_id koji koriste F&B, Spa, MICE

---

# 4. Modul 2 — Hrana i piće (F&B)

F&B modul pokriva sve aspekte usluzivanja hrane i pica: restoran a la carte, room service, bar, doručak (buffet), bife i banket. Usko je integrisan s PMS-om (naplata na sobu), zalihama i financijama.

## 4.1 Funkcionalni zahtjevi

**Restoran i bar**

- Rezervacije stolova — online i telefonski, s upravljanjem kapacitetom sale
- POS terminal — narudzbe po stolu, modifikatori, dijeljenje racuna, split bill
- Naplata na sobu — direktna veza s PMS foliom gosta pri identifikaciji sobom
- Recepture i meni — definisanje jela s normativima, alergenima i kalorijama
- Kuhinjski displej (KDS) — elektronski prikaz narudzbi po sekcijama kuhinje
- Doručak kontrola — evidencija konzumiranja ukljucenih dorucaka (po sobi)
- Inventory pull — automatski odbitak zaliha po unesenoj narudzbi

**Room service i minibar**

- Narudzbe room service — putem sobe, QR koda, mobilne app ili telefona
- Pracenje isporuke — status narudzbe i vrijeme isporuke
- Minibar obracun — fizicko ili senzorsko evidentiranje utroska po sobi
- Naplata — automatsko dodavanje na folio pri check-out ili na zahtjev

**Banket i catering**

- BEO dokument (Banquet Event Order) — detaljan plan svakog dogadjaja
- Konfiguracija sale — razliciti rasporedi (teatar, U-forma, banket, koktel)
- Ugovorena usluga — meni, pice, posebni zahtjevi, broj osoba
- Obracun i fakturiranje — vezano za MICE modul i korporativnog klijenta

## 4.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Narudzba | ID, sto_br, konobar_id, stavke[], status, timestamp, folio_id |
| Jelo/Pice | ID, naziv, kategorija, cijena, normativ[], alergeni[], kalorije, aktivan |
| Sto | ID, sala_id, kapacitet, status (slobodan│zauzet│rezervisan), QR_kod |
| BEO | ID, dogadjaj_id, datum, sala_id, osoba_br, meni_id, napomene, status |
| Minibar_Log | ID, soba_id, artikal_id, kolicina, datum, naplata_status |

---

# 5. Modul 3 — Finansije i računovodstvo

Finansijski modul je centralni punkt gdje se konsoliduju svi prihodi i troskovi hotela. Integrisan je s PMS-om (folio), F&B POS-om, Spa, MICE i Nabavkom. Mora podrzavati visejezicni/visvalutni rad i lokalne fiskalne zahtjeve.

## 5.1 Funkcionalni zahtjevi

**Naplata i folio**

- Gostinski folio — jedinstven racun gosta koji prima stavke iz svih odjela (soba, spa, restoran, MICE)
- Split folio — razdvajanje racuna po vrsti troska (licno/firma), vise folija po rezervaciji
- Group master folio — jedinstven racun za grupu gostiju
- Vaucer i gift kartice — kreiranje, prodaja, aktivacija i pracenje stanja
- Nacini placanja — kartica, gotovina, bankovni transfer, vaucer, plati firma
- Fiskalnost — integracija s fiskalnim uredajem u skladu s lokalnim propisima
- Devizno poslovanje — prihvatanje viseceljutnih transakcija s automatskom konverzijom

**Računovodstvo i kontroling**

- Glavna knjiga (GL) — automatsko knjizenje svih transakcija po kontnom planu
- Obaveze (AP) — upravljanje fakturama dobavljaca, rokovi placanja
- Potrazivanja (AR) — pracenje dugovanja korporativnih klijenata i agencija
- PDV obracun — automatski po vrsti usluge i fiskalnoj regulativi
- Troskovni centri — pracenje prihoda i troskova po odjelu (sobe, F&B, spa, konf.)
- Zatvaranje perioda — dnevno, mjesecno, godisnje s blokiranjem prethodnih perioda
- Budzetiranje — unos plana, pracenje realizacije i varijansnih analiza

## 5.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Transakcija | ID, folio_id, iznos, valuta, PDV, nacin_plac., odjel, timestamp, storno_ref |
| GL_Knjizenje | ID, transakcija_id, konto, duguje, potrazuje, period, status |
| Troskovi_Centar | ID, naziv, period, prihod, troskovi, marza, plan, varijansa |
| Faktura_Dobavljac | ID, dobavljac_id, iznos, rok_placanja, status, GL_konto |
| Devizna_Transakcija | ID, transakcija_id, izvorna_valuta, iznos_original, kurs, datum |

---

# 6. Modul 4 — Prodaja i marketing

Komercijalni modul pokriva cjelokupno upravljanje odnosom s gostima i klijentima — od akvizicije i loyalty programa do korporativnih ugovora i digitalnih kampanja. Centralni CRM mora biti jedinstven za sve odjele.

## 6.1 Funkcionalni zahtjevi

**CRM i loyalty**

- Jedinstven profil gosta — konsolidacija svih interakcija: sobe, spa, restoran, konferencije
- Loyalty program — visenivojski bodovni sistem (Bronze/Silver/Gold/Platinum) s automatskim napredovanjem
- Preferencije gosta — tip sobe, jastuk, alergeni, omiljeni terapeut, posebni datumi
- Historija boravaka — pregled svih posjeta s ukupnom potrosnjom i uslugama
- Segmentacija — automatska kategorizacija po ucestalosti, potrosnji i profitabilnosti
- Rodjendanske i posebne prilike — automatski marketing trigger s personalizovanom ponudom

**Distribucija i upravljanje prihodima**

- Rate management — centralno upravljanje cijenama po kanalu, datumu i segmentu
- Best Available Rate (BAR) — automatska logika najnize dostupne cijene
- Korporativni ugovori — ugovorene cijene s pracenjem produkcije i ispunjenja obaveza
- Paket aranzmani — kreiranje room+spa, room+breakfast i ostalih paketa
- Promotion engine — vremenski ogranicene akcije s automatskom primjenom popusta
- Commission tracking — pracenje provizija agentima i OTA kanalima

**Digitalni marketing**

- Email kampanje — segmentirane kampanje s pracenjem otvaranja i konverzija
- SMS i push notifikacije — personalizovane poruke pre, za vrijeme i poslije boravka
- Review management — prikupljanje i upravljanje recenzijama (TripAdvisor, Google, Booking)
- Social media pracenje — monitoring mentions i sentiment analiza
- Referalni program — nagradivanje gostiju koji preporucuju hotel

## 6.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| CRM_Profil | ID, gost_id, loyalty_nivo, bodovi, ukupna_potrosnja, br_boravaka, preferencije |
| Korporativni_Klijent | ID, firma, kontakt, ugovorena_cijena, produkcija_plan, produkcija_real |
| Kampanja | ID, naziv, kanal, segment, datum, br_primaoca, br_otvaranja, prihod_generirani |
| Recenzija | ID, gost_id, platforma, ocjena, komentar, datum, odgovor_menadzment |
| Rate_Plan | ID, naziv, tip, cijena_baza, uvjeti_otkazivanja, min_nocenja, kanal |

---

# 7. Modul 5 — Konferencije i MICE

MICE (Meetings, Incentives, Conferences, Exhibitions) modul upravljanja poslovnim dogadjajima. Usko je integrisan s F&B modulom (banket), Financijama (fakturiranje) i CRM-om (korporativni klijenti).

## 7.1 Funkcionalni zahtjevi

**Upravljanje salama i prostorima**

- Registar sala — kapacitet po rasporedu (teatar, U-forma, razred, koktel, banket)
- Vizualni kalendar — zauzetost svih sala u realnom vremenu
- Oprema sala — AV tehnika, projektor, flip chart, pracenje dostupnosti i rezervacije
- Kombinovanje prostora — spajanje vise sala za vece dogadjaje
- Prateci sadrzaji — kafe pauze, dorucak, rucak, vecera vezani za dogadjaj
- Blokiranje za hotelske goste vs. korporativne klijente — razlicite tarife

**Event management i dokumentacija**

- BEO — Banquet Event Order: detaljan nalog za svaki dogadjaj s vremenskim planom
- Function Sheet — lista svih usluga, rasporeda, osoblja i potrebnog materijala
- Ponuda i ugovor — automatsko generisanje ponude iz sistema s elektronskim potpisom
- Placanje i depoziti — pracenje uplata, ostatka duga i datuma dospijeća
- Evaluacija dogadjaja — anketa zadovoljstva po zavrsetku s generisanjem izvjestaja
- Upravljanje sjedalistu — vizualni alat za raspored sjedista po nacrt sale

## 7.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Dogadjaj | ID, naziv, organizator_id, datum_od, datum_do, tip, br_ucesnika, status |
| BEO | ID, dogadjaj_id, sala_id, datum_vr, usluge[], konfiguracija, napomene, odobren |
| Sala | ID, naziv, kapacitet_tip[], oprema[], kat, status, cijena_po_satu |
| Ponuda_MICE | ID, klijent_id, dogadjaj_id, ukupni_iznos, datum_poslan, datum_isteka, status |
| Uplata_Depozit | ID, dogadjaj_id, iznos, datum, tip (depozit│dio│finalni), status |

---

# 8. Modul 6 — Wellness i Spa

Spa modul opsluzuje dvije kategorije klijenata — hotelske goste i eksterne klijente. Integrisan je s PMS-om (gost podaci, folio), CRM-om (loyalty, profil) i Financijama (naplata). Ovaj modul je detaljno obraden u prethodnoj verziji dokumenta i ovdje je prikazan u punom kontekstu hotelskog IS-a.

## 8.1 Funkcionalni zahtjevi

**Booking i upravljanje tretmanima**

- Katalog usluga — masaze, kozmetika, hidroterapija, wellness paketi, fitness
- Multi-kanal booking — online, mobilna app, telefon, spa recepcija
- Diferencirana cijena — hotelska tarifa vs. eksterna tarifa, sezonske akcije
- Real-time dostupnost — termini, terapeuti, prostorije u realnom vremenu
- PMS integracija — automatski uvoz podataka hotelskog gosta bez duplog unosa
- Grupne rezervacije — paketi za korporativne klijente i incentive grupe
- Otkazivanje i no-show politika — automatska naknada prema definisanoj politici

**Terapeuti i kapaciteti**

- Registar terapeuta — specijalizacije, certifikati, rasporedi rada
- Automatska dodjela — predlaganje terapeuta po dostupnosti i specijalizaciji
- Upravljanje prostorijama — sobe tretmana, bazen, sauna, fitness zona
- Retail shop — kozmetika, suplementi, spa pokloni s upravljanjem zalihama
- Protokoli ciscenja — evidentiranje pripreme i ciscenja svake prostorije
- KPI terapeuta — br. tretmana, prihod, prosjecna ocjena klijenata

**CRM i loyalty spa**

- Jedinstven profil — spa CRM integrisan s hotelskim CRM-om (isti gost_id)
- Spa loyalty bodovi — bodovi za tretmane dodaju se na hotelski loyalty profil
- Historija tretmana — pracenje preferencija, alergija i kontraindikacija
- Anketa zadovoljstva — automatska 2 sata po zavrsetku tretmana
- B2B korporativni — ugovorene cijene za firme, grupno fakturiranje

## 8.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Rezervacija_Spa | ID, klijent_id, usluga_id, terapeut_id, prostorija_id, datum_vr, status, kanal |
| Usluga_Spa | ID, naziv, kategorija, trajanje_min, cijena_hotel, cijena_eksterni, oprema_id |
| Terapeut | ID, ime, specijalizacije[], certifikati[], raspored_id, aktivan |
| CRM_Spa | ID, gost_id, br_posjeta, omilj_tretman, alergije, spa_bodovi |
| Retail_Spa | ID, SKU, naziv, cijena, zaliha, kategorija, dobavljac_id |

---

# 9. Modul 7 — Ljudski resursi (HR)

HR modul pokriva cjelokupno upravljanje osobljem hotela. Integrisan je s Financijama (plate), svim operativnim modulima (rasporedi), i IT-om (pristupna prava i korisnicke uloge).

## 9.1 Funkcionalni zahtjevi

**Registar i ugovori**

- Maticna evidencija — personalni dosijei za svo osoblje s ugovornim podacima
- Organizacijska struktura — hijerarhija, odjeli, pozicije i nivoi odgovornosti
- Ugovori i aneksi — pracenje tipa ugovora, trajanja, produzenja
- Upravljanje dokumentima — skenovi ugovora, certifikata, licenci

**Rasporedi i prisustvo**

- Tjedno planiranje smjena — po odjelu, s uvazavanjem odmora i raspolozivosti
- Evidencija prisustva — integracija s kartičnim sistemom ili biometrijom
- Prekovremeni rad — pracenje i obracun u skladu s radnim zakonodavstvom
- Godisnji odmori — zahtjevi, odobravanje, pracenje stanja dana
- Bolovanje i odsustva — evidentiranje razlicitih tipova odsutnosti

**Plate i obuka**

- Payroll obracun — automatski na osnovu smjena, prisutnosti i benefita
- Bonusi i naknade — pracenje varijabilnog dijela plate po odjelu
- Plan obuke — godisnji plan edukacije po poziciji
- E-learning integracija — pracenje polazenja kurseva i certifikacija
- Performanse — godisnje i polugodisnje ocjenjivanje s ciljevima

## 9.2 Podatkovni entiteti

| Entitet | Kljucni atributi |
|---------|-----------------|
| Zaposleni | ID, ime, pozicija, odjel, tip_ugovora, datum_zaposlenja, aktivan |
| Smjena | ID, zaposleni_id, datum, od, do, tip (rad│odmor│bolovanje│slobodan) |
| Payroll | ID, zaposleni_id, period, osnovna_plata, dodaci, odbitci, neto |
| Obuka | ID, zaposleni_id, naziv, datum, institucija, potvrda_url, status |
| Performansa | ID, zaposleni_id, period, ocjena, ciljevi, komentar_menadzera |

---

# 10. Moduli 8–11 — Tehničko, Nabavka, IT i BI

## 10.1 Modul 8 — Tehničko održavanje

Modul za upravljanje fizickom imovinom hotela, preventivnim i korektivnim odrzavanjem, energetikom i sigurnosnim sustavima.

**Funkcionalni zahtjevi**

- Registar imovine — sva oprema s tehnickim karakteristikama i garancijama
- Preventivni plan odrzavanja — automatsko generisanje radnih naloga po rasporedu
- Korektivni radni nalozi — prijava kvara, dodjela tehnicaru, pracenje rjesavanja
- Energetski menadzment — pracenje utroska struje, vode i gasa po zoni
- Sigurnosni sustavi — pracenje kartičnog pristupa, CCTV arhive, alarma
- Integracija s Housekeeping — automatski signal za ciscenje pri odjavi gosta
- Odrzavanje spa opreme — posebni protokoli za bazene, saune, hidromasazne kade

**Podatkovni entiteti**

| Entitet | Kljucni atributi |
|---------|-----------------|
| Imovina | ID, naziv, lokacija, tip, serijski_br, datum_nabavke, garancija_do |
| Radni_Nalog | ID, imovina_id, tip, opis, prioritet, dodijeljeno, status, rjesenje |
| Energetika | ID, zona_id, period, kWh, m3_vode, m3_gasa, troskovi |
| Preventivni_Plan | ID, imovina_id, interval_dana, zadnja_izvedba, sljedeca |

## 10.2 Modul 9 — Nabavka i upravljanje zalihama

Centralizovana nabavka pokriva sve odjele: F&B (namirnice, pice), Spa (kozmetika, materijal), Housekeeping (posteljina, kemikalije) i Tehnicko (rezervni dijelovi).

**Funkcionalni zahtjevi**

- Registar dobavljaca — kontakti, ugovorene cijene, rokovi isporuke, ocjene
- Narudžbenice (PO) — kreiranje, odobravanje i pracenje narudzebi
- Primka robe — evidentiranje primljene robe s provjerom kolicine i kvalitete
- Upravljanje zalihama — stanje, minimalni nivoi, automatska narudzba pri dostignutom minimumu
- Meduodjeljska narudzba — F&B trazi zalihe iz centralnog skladista
- Inventura — periodicna provjera stanja s generisanjem odstupanja
- Upravljanje otpadom — evidentiranje kala, loma i otpisa

**Podatkovni entiteti**

| Entitet | Kljucni atributi |
|---------|-----------------|
| Dobavljac | ID, naziv, kontakt, kategorija, ugovorena_cijena, rok_isporuke, ocjena |
| Narudzbenica | ID, dobavljac_id, stavke[], ukupno, status, datum, primio_id |
| Zaliha | ID, naziv, jed_mjere, kolicina, min_kolicina, odjel, lokacija, cijena_nabavna |
| Inventura | ID, datum, odjel, stavke[(zaliha_id,ocekivano,stvarno,razlika)], status |

## 10.3 Modul 10 — IT infrastruktura i integracije

**Funkcionalni zahtjevi**

- API Gateway — jedinstven ulazni punkt za sve integracije (PMS, OTA, POS, Spa, MICE)
- Single Sign-On (SSO) — jedinstven login za svo osoblje kroz Active Directory
- Role-Based Access Control (RBAC) — granularne permisije po ulozi i modulu
- GDPR compliance — upravljanje privolama, pravo brisanja, audit log pristupa
- Backup i disaster recovery — automatski backup s definisanim RPO (1h) i RTO (4h)
- Monitoring — real-time pracenje dostupnosti svih servisa s alertima
- Enkripcija — TLS 1.3 za konekcije, AES-256 za osjetljive podatke u mirovanju
- PCI DSS — uskladjenost za obradu platnih kartica

## 10.4 Modul 11 — BI i upravljacko izvještavanje

Svaki odjel ima vlastite KPI, ali management treba konsolidovani pogled na cijelo poslovanje.

| Oblast | KPI metriche |
|--------|-------------|
| Smještaj | RevPAR, ADR, Occupancy %, GOPPAR, Cost per occupied room |
| F&B | Prihod po coveru, Gross profit %, Prosjek potrosnje/gostu, Otpad % |
| Spa | Popunjenost kapaciteta %, RevPT, NPS, Prihod ext. klijenata % |
| MICE | Prihod po kvadratu sale, Br. dogadjaja/mj., Ponavljanje klijenata % |
| Ukupno | EBITDA po odjelu, RevPAG (Revenue per available guest), NPS hotel |

---

# 11. Integracijska arhitektura

Preporucena arhitektura temelji se na API-first pristupu s centralnim Event Bus-om koji koordinira komunikaciju medu modulima u realnom vremenu. Ovakav pristup omogucava postepenu migraciju — moduli se zamjenjuju/dodaju jedan po jedan bez zastoja.

## 11.1 Arhitekturni slojevi

| Sloj | Komponente | Tehnologije / standardi |
|------|-----------|------------------------|
| Prezentacijski | Web app, Mobilna app, Kiosk, TV | React/Vue SPA, PWA, React Native |
| Poslovni (BLL) | PMS engine, Booking, CRM, Spa, F&B | Mikroservisi ili modulara monolit |
| Integracijski | API Gateway, Event Bus, Adapteri | REST, WebSocket, HTNG, OTA XML |
| Podatkovni | Relacijska BD, Cache, Dokument BD | PostgreSQL, Redis, MongoDB/S3 |
| Infrastrukturni | Cloud/on-premise, LB, Container | Docker/K8s, Nginx, SSL |

## 11.2 Integracijska mapa medu modulima

| Modul izvora | Modul primatelja | Tip podatka | Nacin |
|-------------|-----------------|-------------|-------|
| PMS (rezervacija) | Spa, F&B, MICE, HR | Gost_id, soba, datumi | REST API push |
| PMS (check-in) | Spa, F&B | Status gosta aktivan | Event Bus |
| F&B POS | Finansije | Transakcija, folio stavka | Real-time REST |
| Spa booking | PMS folio | Naknada na sobu | REST API |
| MICE faktura | Finansije, CRM | Uplata, korporat. potrosnja | REST API |
| HR rasporedi | Spa, F&B, Housek. | Dostupnost osoblja | REST API |
| Nabavka primka | Zalihe svih odjela | Stanje, kolicine | Event Bus |
| Svi moduli | BI/Reporting | KPI podaci | Data warehouse ETL |

## 11.3 Kljucni API endpointi

| Endpoint | Metod | Opis |
|----------|-------|------|
| /api/guests/{id} | GET | Jedinstven profil gosta (CRM + loyalty + historija) |
| /api/reservations | GET/POST | Rezervacije soba — lista i kreiranje |
| /api/folio/{id}/charge | POST | Dodavanje stavke na folio gosta |
| /api/spa/bookings | GET/POST | Spa rezervacije |
| /api/spa/availability | GET | Slobodni termini i terapeuti |
| /api/fnb/orders | POST | Narudzba u restoranu ili room service |
| /api/mice/events | GET/POST | MICE dogadjaji i BEO |
| /api/hr/schedule | GET | Rasporedi osoblja po odjelu i datumu |
| /api/inventory/stock | GET/PUT | Stanje zaliha i azuriranje |
| /api/finance/reports | GET | Finansijski izvjestaji (parametarski) |
| /api/bi/kpi | GET | KPI dashboard podaci po periodu i odjelu |

---

# 12. Scenariji integracije s postojećim IS-om

Ovisno o tehnickom stanju postojeceg IS-a, preporucuju se tri scenarija. Svaki je prikazan s prednostima, rizicima i preporukom kada primjeniti.

## Scenario A — Modularno prosirenje postojeceg IS-a

*Preporuceno kada: postojeci IS ima modularnu arhitekturu, dostupan source code i sposobnost da se prosiruje bez zamjene jezgra.*

- Novi moduli (Spa, MICE, BI) razvijaju se kao dodaci unutar postojeceg IS-a
- Dijele istu bazu podataka, SSO i korisnicke sesije
- **Prednost:** nema sinhronizacijskih problema, jedinstven podatkovni model
- **Rizik:** brzina razvoja zavisi od tehnickih ogranicenja jezgre IS-a
- **Trosak:** nizak (nema migracije), ali moze biti visok ako jezgra ima tehnicke dugove

## Scenario B — Zamjena IS-a novim integrisanim rjesenjem

*Preporuceno kada: postojeci IS je tehnoloski zastarjeo, ne podrzava API-first pristup ili nema podrske vendora.*

- Odabir novog hotelskog IS-a koji nativno pokriva vise oblasti (npr. Opera Cloud, Apaleo, Mews)
- Postepena migracija: novi IS preuzima modul po modul dok stari ostaje paralelan
- **Prednost:** moderno, cloud-native rjesenje s bogatim out-of-the-box funkcionalnostima
- **Rizik:** visoki pocetni troskovi, kompleksna migracija podataka, promjena procesa
- **Trosak:** visok implementacijski, ali nizak dugorocni operativni

## Scenario C — Hibridni API-first pristup

*Preporuceno kada: postojeci IS pokriva neke oblasti dobro, ali drugi zahtijevaju specijalizovane alate.*

- PMS jezgra ostaje — za rezervacije, check-in/out i osnovno folio upravljanje
- Spa — specijalizovani SaaS (Mindbody, Spasoft) s API vezom na PMS
- MICE — zaseban event management alat (Delphi, Opera Sales) s API vezom
- CRM — centralizovani CRM (Salesforce Hospitality, Revinate) koji agregira sve
- Middleware/Event Bus koordinira razmjenu podataka medu svim sistemima
- **Prednost:** best-of-breed za svaku oblast, brza implementacija modula po modula
- **Rizik:** kompleksnost integracija, potencijalni sihronizacijski problemi

---

# 13. Prioritizacija i fazna implementacija

| Modul / Funkcija | Prioritet | Integ. IS | API | Faza |
|-----------------|-----------|-----------|-----|------|
| PMS — Rezervacije i check-in/out | Visok | Da | Da | **Faza 1** |
| PMS — Folio i naplata | Visok | Da | Da | **Faza 1** |
| Finansije — Transakcije i GL | Visok | Da | Da | **Faza 1** |
| CRM — Jedinstven profil gosta | Visok | Djelimicno | Da | **Faza 1** |
| F&B — POS restoran i bar | Visok | Djelimicno | Da | **Faza 1** |
| IT — API Gateway i SSO | Visok | Da | Da | **Faza 1** |
| GDPR i sigurnost podataka | Visok | Da | Da | **Faza 1** |
| Spa — Booking i tretmani | Visok | Djelimicno | Da | **Faza 1** |
| Spa — PMS integracija (folio/gost) | Visok | Da | Da | **Faza 1** |
| Revenue management | Srednji | Djelimicno | Da | **Faza 2** |
| Loyalty program (hotel+spa) | Srednji | Djelimicno | Da | **Faza 2** |
| Channel manager / OTA integracija | Srednji | Da | Da | **Faza 2** |
| F&B — Room service i minibar | Srednji | Djelimicno | Da | **Faza 2** |
| MICE — Sale i event management | Srednji | Ne | Da | **Faza 2** |
| HR — Rasporedi i plate | Srednji | Ne | Da | **Faza 2** |
| Spa — Terapeuti i rasporedi | Srednji | Djelimicno | Da | **Faza 2** |
| KPI dashboard (svi odjeli) | Srednji | Da | Da | **Faza 2** |
| Tehnicko odrzavanje | Srednji | Ne | Da | **Faza 2** |
| Nabavka — Dobavljaci i PO | Srednji | Ne | Da | **Faza 3** |
| F&B — Banket i catering | Nizak | Ne | Da | **Faza 3** |
| Marketing automatizacija | Nizak | Ne | Da | **Faza 3** |
| Mobilna aplikacija (gosti) | Nizak | Ne | Da | **Faza 3** |
| Spa — Retail shop | Nizak | Ne | Da | **Faza 3** |
| Energetski menadzment | Nizak | Ne | Da | **Faza 3** |
| Inventura i upravljanje otpadom | Nizak | Ne | Da | **Faza 3** |

## 13.1 Preporuceni vremenski plan

| Faza | Period | Kljucne isporuke | Cilj |
|------|--------|-----------------|------|
| Faza 1 — Temelj | Mj. 1–4 | PMS, Folio, CRM, F&B POS, Spa booking, API GW, GDPR | Operativna srz sistema |
| Faza 2 — Rast | Mj. 5–9 | Loyalty, MICE, HR, Odrzavanje, Revenue mgmt., KPI | Puna operativna pokrivenost |
| Faza 3 — Optimizacija | Mj. 10–15 | Nabavka, Marketing auto., Mob. app, Retail, Energetika | Automatizacija i analitika |

---

# 14. GDPR i zaštita podataka

Hotel prikuplja i obradjuje licne podatke iz vise izvora i za razlicite svrhe. Svaki modul mora biti projektovan uz GDPR uskladjenost od pocetka (privacy-by-design).

| Podatak / Kategorija | Modul izvora | Pravna osnova | Rok cuvanja |
|---------------------|-------------|--------------|-------------|
| Ime, email, telefon | PMS, CRM, Spa | Ugovorni odnos | 3 god. po zadnjem kontaktu |
| Broj pasoša/ličnog | PMS (check-in) | Zakonska obaveza | Prema propisima drzave |
| Podaci o placanju | Finansije, POS | Ugovorni odnos | PCI DSS (7 god.) |
| Zdravstveni podaci (kontraindik.) | Spa | Eksplicitna privola | Trajanje tretmana + 1 god. |
| Lokacija i pristup sobama | PMS, IT | Legitimni interes (sigurnost) | 30 dana |
| Preferencije i navike | CRM, Spa | Privola | Do povlacenja privole |
| CCTV snimci | Tehnicko/IT | Legitimni interes | 72 sata (standard) |
| Kampanje — email otvaranja | Marketing | Privola | Do odjave (unsubscribe) |

## 14.1 Tehnicke mjere

- Enkripcija podataka u mirovanju (AES-256) i pri prenosu (TLS 1.3)
- Pseudonimizacija osjetljivih polja u bazama podataka
- Audit log — svaki pristup osjetljivim podacima biljezi se s ID-om, vremenom i IP adresom
- Pravo na brisanje — soft-delete + anonimizacija s cuvanjen poslovnih zapisa
- Prenosivost — export profila gosta u JSON/CSV formatu
- Privola verzionisana — cuvanje teksta privole koji je bio prikazan u trenutku pristajanja

---

# 15. Glosar pojmova

| Pojam | Definicija |
|-------|-----------|
| PMS | Property Management System — jezgreni hotelski IS za upravljanje sobama i gostima |
| Folio | Racun gosta u PMS-u koji prima stavke svih odjela za trajanja boravka |
| OTA | Online Travel Agency — Booking.com, Expedia i sl. platforme za online rezervacije |
| GDS | Global Distribution System — Amadeus, Sabre, Galileo za agencijske rezervacije |
| RevPAR | Revenue per Available Room — kljucni KPI smjestajne profitabilnosti |
| ADR | Average Daily Rate — prosjecna cijena sobe u noci |
| GOPPAR | Gross Operating Profit per Available Room — sveobuhvatan pokazatelj profitabilnosti |
| RevPT | Revenue per Treatment — prihod po obavljenom spa tretmanu |
| NPS | Net Promoter Score — mjera lojalnosti i zadovoljstva gostiju |
| MICE | Meetings, Incentives, Conferences, Exhibitions — poslovni dogadjaji |
| BEO | Banquet Event Order — operativni nalog za svaki organizovani dogadjaj |
| RevPAG | Revenue per Available Guest — ukupan prihod po gostu iz svih izvora |
| CMMS | Computerized Maintenance Management System — IS za tehnicko odrzavanje |
| CRM | Customer Relationship Management — upravljanje odnosom s klijentima |
| SSO | Single Sign-On — jedinstven login za sve aplikacije unutar organizacije |
| RBAC | Role-Based Access Control — kontrola pristupa po ulozi korisnika |
| RPO/RTO | Recovery Point/Time Objective — ciljevi oporavka sistema pri havariji |
| PCI DSS | Payment Card Industry Data Security Standard — sigurnost platnih kartica |
| ETL | Extract, Transform, Load — proces punjenja data warehouse-a za BI |
| GL / AP / AR | General Ledger / Accounts Payable / Accounts Receivable — racunovodstveni moduli |
| KDS | Kitchen Display System — digitalni prikaz narudzbi u kuhinji |
| GDPR | General Data Protection Regulation — EU uredba o zastiti licnih podataka |

---

*Verzija 2.0 ovog dokumenta prosiruje prvu verziju (Wellness & Spa specifikacija) na cijeli hotelski ekosistem. Preporucuje se zajednicka revizija dokumenta s IT direktorom, spa menadzerom, F&B menadzerom i financijskim direktorom.*

---

**— kraj dokumenta — Ver. 2.0**

*Povjerljivo — interni dokument | Hotel IS Specifikacija v2.0*
