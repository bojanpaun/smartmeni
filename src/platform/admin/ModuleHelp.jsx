import styles from './ModuleHelp.module.css'

const HELP_CONTENT = {

  // ─────────────────────────────────────────────
  menu: {
    title: 'Digitalni meni — uputstvo',
    intro: 'Ovaj modul omogućava upravljanje digitalnim menijem, narudžbama, barskim i kuhinjskim workflowom i javnom web stranicom restorana.',
    sections: [
      {
        icon: '🗂️',
        title: 'Kategorije i stavke menija',
        steps: [
          'Idi na Uređivanje menija',
          'Klikni + Kategorija da dodaš novu kategoriju (npr. Predjela, Riba, Piće)',
          'Za barske artikle (kokteli, alkohol...) uključi toggle Je bar kategorija — ove stavke idu na Bar stanicu, ne kuhinjsku',
          'Unutar kategorije klikni + Dodaj jelo i popuni naziv, opis, cijenu i sliku',
          'Jela možeš označiti kao Dnevnu ponudu — prikazuju se istaknuto u guest meniju',
        ],
      },
      {
        icon: '🧾',
        title: 'Narudžbe',
        steps: [
          'U sekciji Narudžbe pratiš sve aktivne narudžbe u realnom vremenu',
          'Svaka narudžba ima status po stanici: kuhinja i bar se prate odvojeno',
          'Status narudžbe: Primljeno → u pripremi (kuhinja/bar) → Gotovo → Servirano',
          'Konobar vidi status svake stavke — ne mora zvati kuhinju da pita',
          'Staff portal konobara (/slug/staff) prikazuje station statuse u realnom vremenu — 🧑‍🍳 Kuhinja priprema/gotova, 🍷 Bar priprema/gotov — identično admin prikazu',
        ],
      },
      {
        icon: '🧑‍🍳',
        title: 'Kuhinja i Bar — odvojene stanice',
        steps: [
          'Kuhinja i Bar su odvojeni tabovi u admin sidebaru, svaki sa realtime badge-om',
          'Kuhinja prikazuje samo narudžbe koje sadrže kuhinjske stavke (bez bar kategorija)',
          'Bar prikazuje samo narudžbe sa barskim artiklima (kategorije označene Je bar)',
          'Osoblje kulinarne stanice i šank-a rade potpuno nezavisno — svako vidi samo svoje',
          'Narudžba je gotova za konobara tek kad su obje stanice označile svoj dio kao Gotovo',
        ],
      },
      {
        icon: '🔔',
        title: 'Zahtjevi konobara',
        steps: [
          'Gosti šalju zahtjeve iz menija (Pozovi konobara, Donesi račun...)',
          'Novi zahtjev se prikazuje kao crveni badge na Zahtjevi tabu u sidebaru',
          'Konobar odabire zahtjev, piše kratki odgovor i označava kao Riješeno',
          'Poruke koje gosti vide definišeš u Postavke menija → Poruke',
        ],
      },
      {
        icon: '⚙️',
        title: 'Postavke menija — tabovi',
        steps: [
          'Opšte: naziv, lokacija, telefon, radno vrijeme, opis, boja brenda, trajanje QR sesije',
          'Vidljivost: za svaku funkciju odaberi ko je vidi (Isključeno / Registrovani / Svi) — naručivanje, konobar, rezervacije, registracija gostiju, hotel link, spa link',
          'Poruke: prilagodi poruke koje gosti biraju za poziv konobara i poruke odbijanja narudžbi',
          'Predlošci: odaberi vizualni stil guest menija od dostupnih predložaka — promjena je trenutna',
        ],
      },
      {
        icon: '🌐',
        title: 'Sajt restorana',
        steps: [
          'U sidebaru klikni Sajt restorana da otvoriš vizualni editor javne web stranice',
          'Editor je podjeljen: lijevo forma, desno live preview koji se ažurira dok tipkaš',
          'Blokovi (Hero, Priča, Galerija, Specijaliteti...) se pale/gase i reorderuju drag & drop-om',
          'Svaki blok ima odabir izgleda (layout varijante) i polja za sadržaj i slike',
          'Klikni Sačuvaj da objaviš promjene — stranica je dostupna na rest.by.me/vas-slug/home',
        ],
      },
      {
        icon: '📱',
        title: 'QR kod restorana',
        steps: [
          'Idi na QR kod za generalni QR koji vodi na meni bez podatka o stolu',
          'Koristi ga na ulazu, vizit karti, društvenim mrežama ili jelovniku',
          'Za narudžbe po stolu koristi QR kodove iz modula Stolovi (svaki sto ima vlastiti QR)',
        ],
      },
    ],
    tips: [
      'Bar kategorije su ključne za ispravan workflow — svaka kategorija pića treba biti označena Je bar',
      'Predlošci i boja brenda zajedno grade vizualni identitet guest menija',
      'QR po stolu (modul Stolovi) je preporučen za svakodnevno korišćenje jer prati s kojeg stola dolazi narudžba',
      'Vidljivost naručivanja možeš isključiti za goste bez registracije — korisno za VIP prikaze ili demo mode',
      'Sajt restorana i guest meni su odvojeni: meni je za narudžbe za stolom, sajt je javna web stranica',
      'Konobar može naplatiti narudžbu na sobu direktno iz Staff portala (ne samo iz admina) — vidljivo kad je Hotel modul aktivan',
    ],
  },

  // ─────────────────────────────────────────────
  staff: {
    title: 'Role i permisije — uputstvo',
    intro: 'Ovaj modul služi za kreiranje i upravljanje rolama. Dodjela rola zaposlenima radi se u modulu HR → Zaposleni.',
    sections: [
      {
        icon: '🔑',
        title: 'Kreiranje role',
        steps: [
          'Klikni + Nova rola ili odaberi predložak (Konobar, Kuhinja, Bar, Menadžer, Recepcija, Spa terapeut...)',
          'Unesi naziv role',
          'Permisije su grupisane po modulima (horizontalni tabovi): Restoran, Hotel, Spa...',
          'Klikni Odaberi sve za jedan modul ili označi granularne permisije ručno',
          'Sačuvaj rolu',
        ],
      },
      {
        icon: '👤',
        title: 'Dodjela rola zaposleniku',
        steps: [
          'Role se dodjeljuju u modulu HR → Zaposleni',
          'Jedan zaposlenik može imati više rola istovremeno (npr. Konobar + Bar)',
          'Promjene su trenutne — zaposlenik odmah dobija nova prava',
        ],
      },
      {
        icon: '📱',
        title: 'Staff portal (/slug/staff)',
        steps: [
          'Zaposleni pristupaju operativnom prikazu na rest.by.me/vas-slug/staff',
          'Konobar vidi narudžbe sa station statusima (🧑‍🍳 Kuhinja priprema/gotova, 🍷 Bar priprema/gotov) i može naplatiti narudžbu na hotelsku sobu (kad je Hotel modul aktivan)',
          'Sobarica vidi housekeeping zadatke i zahtjeve održavanja u realnom vremenu — promjene statusa (Počni → Završi → Verifikuj) odmah se reflektuju i na admin dashboardu',
          'Recepcija može raditi check-in/check-out sa mobilnog uređaja — Front Desk stranica je mobilno prilagođena',
          'Bez potrebe za admin nalogom — zaposleni se prijavljuju sa vlastitim kredencijalima',
        ],
      },
      {
        icon: '🔒',
        title: 'Sigurnost pristupa',
        steps: [
          'Zaposleni vide samo module za koje imaju permisiju',
          'Vlasnik uvijek ima puni pristup',
          'Permisije možeš mijenjati u bilo kom trenutku',
          'Brisanje role moguće samo ako nije dodijeljena nijednom zaposleniku',
        ],
      },
    ],
    tips: [
      'Konobar tipično treba: narudžbe, zahtjevi konobara, prikaz stolova',
      'Kuhinja treba: narudžbe (kuhinja prikaz) — bez pristupa ostalim modulima',
      'Sobarica treba: housekeeping zadaci — bez pristupa administraciji',
      'Recepcija treba: hotel front desk, rezervacije, folio',
      'Menadžer može imati HR i analitiku pored operativnih funkcija',
    ],
  },

  // ─────────────────────────────────────────────
  tables: {
    title: 'Stolovi — uputstvo',
    intro: 'Crtanje mape stolova, praćenje statusa u realnom vremenu, rezervacije i QR kodovi po stolu.',
    sections: [
      {
        icon: '🗺️',
        title: 'Crtanje mape stolova',
        steps: [
          'Idi na Postavke stolova',
          'Klikni Kvadratni sto ili Okrugli sto u toolbaru da dodaš sto',
          'Klikni na canvas da postaviš sto na željeno mjesto',
          'Prevuci sto mišem da promijeniš poziciju',
          'Klikni na sto da urediš naziv, broj mjesta i oblik',
          'Koristi resize handle (donji desni ugao) da promijeniš veličinu',
          'Klikni Sačuvaj mapu kad završiš',
        ],
      },
      {
        icon: '👁',
        title: 'Prikaz konobara',
        steps: [
          'Idi na Prikaz stolova za realtime pregled',
          'Slobodni stolovi su bijeli, zauzeti narandžasti, rezervisani plavi',
          'Crveni sto sa animacijom znači da gost zove konobara',
          'Klikni na sto da vidiš aktivne narudžbe i ukupan račun',
          'Stranica se automatski osvježava',
        ],
      },
      {
        icon: '📅',
        title: 'Rezervacije',
        steps: [
          'Idi na Rezervacije za upravljanje rezervacijama',
          'Klikni + Nova rezervacija i popuni podatke gosta',
          'Na mapi unutar forme klikni na sto da ga vizuelno odabereš',
          'Koristi Kalendar prikaz da vidiš koji dani su zauzeti',
        ],
      },
      {
        icon: '🌐',
        title: 'Online rezervacije',
        steps: [
          'Uključi toggle Online rezervacije u postavkama',
          'Gosti šalju zahtjeve na rest.by.me/vas-slug/rezervacija',
          'Svaki zahtjev ima status Na čekanju dok ga ne odobriš',
          'Potvrđene rezervacije se prikazuju na mapi konobara',
        ],
      },
      {
        icon: '📱',
        title: 'QR kodovi po stolu',
        steps: [
          'Klikni na sto u editoru pa na dugme QR kod',
          'Svaki sto ima jedinstven QR koji vodi na meni sa brojem stola',
          'Preuzmi i odštampaj — zalijepite na svaki sto posebno',
          'Kad gost skenira i pozove konobara, konobar vidi tačno koji sto zove',
        ],
      },
    ],
    tips: [
      'QR po stolu je preporučen za svakodnevno korišćenje — prati narudžbe po stolu',
      'Mapa se čuva automatski — gosti i konobar odmah vide promjene',
      'Rezervisani stolovi prikazuju se plavom bojom sa vremenima na mapi konobara',
    ],
  },

  // ─────────────────────────────────────────────
  inventory: {
    title: 'Zalihe — uputstvo',
    intro: 'Praćenje namirnica i gotovih proizvoda, ulazi/izlazi i automatski odbitak zaliha pri narudžbi.',
    sections: [
      {
        icon: '📦',
        title: 'Dodavanje stavki inventara',
        steps: [
          'Idi na Inventar i klikni + Nova stavka',
          'Unesi naziv, kategoriju i jedinicu mjere',
          'Postavi trenutnu količinu i minimalnu količinu (prag za upozorenje)',
          'Opcionalno unesi cijenu po jedinici za praćenje troškova',
        ],
      },
      {
        icon: '±',
        title: 'Pokreti zaliha',
        steps: [
          'Klikni ± pored stavke za ručni ulaz ili izlaz',
          'Ulaz — nova dostava, Izlaz — rashod, Korekcija — direktno postavi novu količinu (inventura)',
          'Svaki pokret se bilježi u Pokreti historiji',
        ],
      },
      {
        icon: '🧪',
        title: 'Recepture',
        steps: [
          'Idi na Recepture da definišeš koje namirnice troši svako jelo',
          'Dodaj sastojke i odredi količinu po porciji',
          'Kad se narudžba primi, zalihe se automatski odbijaju prema recepturi',
        ],
      },
      {
        icon: '⚠️',
        title: 'Upozorenja',
        steps: [
          'Stavke ispod minimuma imaju narandžast indikator',
          'Klikni filter Niske zalihe da vidiš samo kritične stavke',
          'Ažuriraj količinu putem ± kad stignu nove zalihe',
        ],
      },
    ],
    tips: [
      'Automatski odbitak radi samo ako su definisane recepture za stavke menija',
      'Korekcija je korisna za usklađivanje stanja nakon fizičke inventure',
      'Spa potrošni materijal (ulja, kreme) prati se u istom modulu — koristi kategoriju Spa',
    ],
  },

  // ─────────────────────────────────────────────
  hr: {
    title: 'HR modul — uputstvo',
    intro: 'Kompletno upravljanje zaposlenima: profili, rasporedi, dolasci, odsustva, zarade i izvještaji.',
    sections: [
      {
        icon: '👤',
        title: 'Zaposleni',
        steps: [
          'Dodaj zaposlenika putem email adrese — kreiraj nalog odmah ili pošalji link za registraciju',
          'Unesi podatke o plati (po satu, sedmično ili mjesečno)',
          'Profil zaposlenika ima tabove: Osnovne info, Zaposlenje, Finansije, Odsustva, Istorija',
          'Rola se dodjeljuje u tabu Zaposlenje — zaposlenik može imati više rola',
        ],
      },
      {
        icon: '📅',
        title: 'Raspored rada',
        steps: [
          'Sedmični pregled: klikni na ćeliju da dodaš smjenu',
          'Jedan zaposlenik može imati više smjena u istom danu',
          'Dnevni pregled: horizontalni timeline (06:00–23:00) — žuti blokovi su nepokriveni periodi',
          'Kopiraj prethodnu sedmicu dugmetom ↩ za brže popunjavanje',
        ],
      },
      {
        icon: '🕐',
        title: 'Evidencija dolazaka',
        steps: [
          'Zaposlenik klika Prijavi se i Odjavi se putem Staff portala',
          'Admin može ručno dodati ili korigovati unos za bilo koji datum',
          'Sistem automatski računa ukupne sate rada po danu',
        ],
      },
      {
        icon: '🌴',
        title: 'Odsustva',
        steps: [
          'Tipovi: Godišnji odmor, Bolovanje, Neplaćeno, Ostalo',
          'Svako odsustvo može biti Na čekanju ili Odobreno — klikni Odobri ili Odbij',
          'Iskorišteni dani godišnjeg odmora se automatski računaju',
        ],
      },
      {
        icon: '💰',
        title: 'Zarade',
        steps: [
          'Dodaj stavke: dnevnica, bonus, odbitak, prekovremeni ili akontacija',
          'Generiši platni list za odabrani period',
          'Platni list: Nacrt → Odobreno → Plaćeno',
        ],
      },
      {
        icon: '📊',
        title: 'Izvještaji',
        steps: [
          'Pregled sati rada i troškova po zaposleniku za odabrani period',
          'Export u CSV za dalju obradu u Excelu',
        ],
      },
    ],
    tips: [
      'Zaposlenik mora imati nalog sa istim emailom da bi se mogao prijaviti i vidio vlastiti raspored',
      'Role se definišu u Administrativnim postavkama → Role i permisije',
      'Staff portal (rest.by.me/slug/staff) je operativni prikaz za zaposlene — bez admin pristupa',
      'Koristite dnevni prikaz rasporeda za brzu provjeru pokrivenosti smjenama',
    ],
  },

  // ─────────────────────────────────────────────
  guests: {
    title: 'Gosti — uputstvo',
    intro: 'Evidencija gostiju koji su se registrirali putem guest menija, istorija posjeta i troškova.',
    sections: [
      {
        icon: '👤',
        title: 'Lista gostiju',
        steps: [
          'Gosti se automatski dodaju u evidenciju kada se registruju putem guest menija',
          'Svaki gost ima profil sa osnovnim podacima (ime, email, telefon)',
          'Pretraži goste po imenu ili emailu',
          'Klikni na gosta da vidiš detalje: historiju narudžbi, ukupnu potrošnju i napomene',
        ],
      },
      {
        icon: '🏨',
        title: 'Hotel gosti',
        steps: [
          'Gosti koji su imali hotelsku rezervaciju automatski su u evidenciji',
          'Hotel gosti mogu pristupiti Guest App-u (rest.by.me/slug/guest) sa rezervacijskim kodom',
          'Guest App prikazuje: detalje boravka, folio troškove, zahtjeve sobi i spa booking',
        ],
      },
      {
        icon: '🔍',
        title: 'Filteri i pretraga',
        steps: [
          'Filtriraj goste po datumu prvog posjeta ili ukupnoj potrošnji',
          'VIP oznaka se može ručno dodijeliti gostima sa visokom potrošnjom',
          'Export liste za marketing ili analitiku',
        ],
      },
    ],
    tips: [
      'Registracija gostiju u guest meniju se može isključiti u Postavke menija → Vidljivost',
      'Hotel gosti su automatski u evidenciji — bez potrebe za ručnim unosom',
      'Loyalty program (buduća faza) će koristiti ovu bazu za bodove i nagrade',
    ],
  },

  // ─────────────────────────────────────────────
  analytics: {
    title: 'Analitika — uputstvo',
    intro: 'Pregled prometa, najprodavanijih jela, trendova i detaljnih izvještaja po periodu.',
    sections: [
      {
        icon: '📊',
        title: 'Pregled prometa',
        steps: [
          'Odaberi period (danas, sedmica, mjesec ili vlastiti raspon)',
          'Grafovi prikazuju prihod i broj narudžbi po danu',
          'Uporedi sa prethodnim periodom da vidiš trend',
        ],
      },
      {
        icon: '🏆',
        title: 'Najprodavanija jela',
        steps: [
          'Lista jela sortirana po broju prodanih porcija',
          'Klikni na jelo da vidiš detalje po danima',
          'Koristi ove podatke da optimizuješ meni i zalihe',
        ],
      },
      {
        icon: '📤',
        title: 'Export',
        steps: [
          'Klikni Export PDF za izvještaj spreman za štampanje',
          'Export Excel daje tabelarni prikaz za dalju obradu',
          'Oba formata uključuju odabrani vremenski period',
        ],
      },
    ],
    tips: [
      'Uporedi promet po danima sedmice da prepoznaš najfrekventnije periode',
      'Prihod po kategorijama pomaže da odlučiš gdje investirati u meni',
      'Hotel Revenue Management (RevPAR, ADR, Occupancy) nalazi se u modulu Hotel → Upravljanje prihodima',
    ],
  },

  // ─────────────────────────────────────────────
  hotel: {
    title: 'Hotel Core — uputstvo',
    intro: 'Kompletno upravljanje hotelskim objektom: sobe, rezervacije, availability kalendar, front desk, folio, housekeeping, online booking i Guest App za goste.',
    sections: [
      {
        icon: '📊',
        title: 'Dashboard',
        steps: [
          'Dashboard prikazuje occupancy widget sa postotkom popunjenosti i statistikama',
          'Dolasci danas — sve rezervacije s check-in datumom danas',
          'Brzi linkovi: Front Desk, Rezervacije, Kalendar, Sobe',
        ],
      },
      {
        icon: '🛏️',
        title: 'Sobe i tipovi soba',
        steps: [
          'Idi na Tipovi soba da definišeš kategorije (Standard, Deluxe, Suite...)',
          'Za svaki tip unesi naziv, opis, max popunjenost, osnovnu cijenu i amenities',
          'Idi na Sobe da vidiš grid svih soba — statusi: Slobodna, Zauzeta, Čišćenje, Održavanje, Blokirana',
          'Klikni na sobu da promijeniš status ili je urediš',
          'Odabirom statusa "Čišćenje" automatski se kreira housekeeping zadatak vidljiv u realnom vremenu u Housekeeping dashboardu i Staff portalu',
        ],
      },
      {
        icon: '📅',
        title: 'Rezervacije',
        steps: [
          'Klikni + Nova rezervacija: gost, tip sobe, soba, datumi, cijena',
          'Sistem automatski računa iznos: broj noći × cijena po noći',
          'Status: Upit → Potvrđena → Prisutna → Odjavljena',
          'Kalendar dostupnosti prikazuje 14 dana u Gantt prikazu — klikni na slobodan period za novu rezervaciju',
        ],
      },
      {
        icon: '🔗',
        title: 'Online booking',
        steps: [
          'Gosti mogu rezervisati direktno na rest.by.me/slug/book',
          'Stranica prikazuje dostupne tipove soba, cijene i formu za booking',
          'Email potvrda se šalje automatski pri rezervaciji',
          'Link na booking dostupan je i na javnoj hotelskoj stranici (/hotel) i Guest App-u',
        ],
      },
      {
        icon: '🛎️',
        title: 'Front Desk — Check-in',
        steps: [
          'Tab Check-in danas prikazuje sve potvrđene rezervacije za danas',
          'Klikni Check-in ✓ — sistem mijenja status rezervacije u Prisutna, sobu u Zauzeta i kreira otvoreni folio',
          'Front Desk stranica je prilagođena za mobilne uređaje — kartice umjesto tabele na mobilnom',
        ],
      },
      {
        icon: '🛎️',
        title: 'Front Desk — Check-out',
        steps: [
          'Tab Check-out prikazuje sve prisutne goste koji trebaju otići',
          'Pregledaj folio prije odjave',
          'Klikni Check-out ✓ — status rezervacije → Odjavljena, soba → Čišćenje, folio → zatvoren',
          'Front Desk stranica je prilagođena za mobilne uređaje — recepcija može raditi check-in/check-out sa telefona',
        ],
      },
      {
        icon: '📋',
        title: 'Folio sistem',
        steps: [
          'Folio se otvara automatski pri check-inu',
          'Prikazuje sve troškove: soba, restoran narudžbe, minibar, spa, ostalo',
          'Klikni + Dodaj stavku za ručno dodavanje troška',
          'Restoranske narudžbe "Naplati na sobu" automatski se dodaju na folio',
          'Spa tretmani sa plaćanjem putem folija automatski se dodaju',
          'Zatvori folio pri odjavi — označava završeno plaćanje',
        ],
      },
      {
        icon: '🧹',
        title: 'Housekeeping',
        steps: [
          'Housekeeping zadaci se kreiraju automatski pri svakom check-outu (soba → Čišćenje); mogu se kreirati i ručno iz admin dashboarda',
          'Sobarice vide zadatke u Staff portalu (/slug/staff) u realnom vremenu — promjene statusa (Počni → Završi → Verifikuj) odmah se reflektuju i na admin dashboardu bez potrebe za osvježavanjem stranice',
          'Admin prati status svih soba u Housekeeping dashboardu',
          'Sobarica označava sobu kao Čistu → status se automatski mijenja u Slobodna',
        ],
      },
      {
        icon: '🔑',
        title: 'Guest App za hotelske goste',
        steps: [
          'Gosti pristupaju Guest App-u na rest.by.me/slug/guest',
          'Login: email + 8-karakterni rezervacijski kod iz email potvrde',
          'Guest App prikazuje: detalje boravka, folio troškove, zahtjevi sobi (housekeeping, room service...) i spa booking',
          'Zahtjevi sobi se pojavljuju u realnom vremenu na Front Desk tabu Zahtjevi',
        ],
      },
      {
        icon: '🍽️',
        title: 'Integracija s restoranom',
        steps: [
          'Konobar može naplatiti narudžbu na hotelsku sobu — klikni Naplati na sobu na serviranoj narudžbi',
          'Unesi broj sobe — sistem provjerava da li gost ima otvoreni folio',
          'Iznos se automatski dodaje na folio gosta',
          '"Naplati na sobu" dugme postoji i u Staff portalu (konobar modul) — ne samo u admin panelu',
        ],
      },
      {
        icon: '💹',
        title: 'Upravljanje prihodima',
        steps: [
          'Dashboard prikazuje ADR (prosječna cijena sobe), RevPAR i Occupancy Rate',
          'Grafovi trendova po sedmicama i mjesecima',
          'Cjenovni planovi: unesi sezonske ili weekday/weekend cijene po tipu sobe',
          'Export analitike u PDF/Excel',
        ],
      },
    ],
    tips: [
      'Kalendar dostupnosti je najbrži način da vidiš popunjenost — koristi ga svakodnevno',
      'Folio se kreira automatski pri check-inu — ne trebaš ga ručno kreirati',
      'Housekeeping zadaci se kreiraju automatski — sobarice ih vide samo u Staff portalu',
      'Guest App link šalje se automatski u email potvrdi rezervacije',
      'Hotelska javna web stranica (rest.by.me/slug/hotel) uređuje se u Hotel → Sajt hotela',
      'Rezervacije, Housekeeping i Upravljanje prihodima stranice su mobilno prilagođene — kartice umjesto tabela na mobilnim uređajima',
    ],
  },

  // ─────────────────────────────────────────────
  spa: {
    title: 'Spa & Wellness — uputstvo',
    intro: 'Kompletno upravljanje spa centrom: katalog tretmana, terapeuti, kabine, booking, kalendar i analitika.',
    sections: [
      {
        icon: '💆',
        title: 'Tretmani (katalog)',
        steps: [
          'Idi na Tretmani da definišeš katalog usluga (masaže, facial, wellness...)',
          'Za svaki tretman unesi: naziv, kategoriju, trajanje, buffer između termina i cijenu',
          'Označi koji tipovi kabina mogu primiti ovaj tretman (treatment room, wet facility...)',
          'Tretmani sa requires_consultation zahtijevaju prethodnu konzultaciju pri bookingu',
        ],
      },
      {
        icon: '👤',
        title: 'Terapeuti',
        steps: [
          'Idi na Terapeuti da upravljaš profilima — terapeut mora biti kreiran kao zaposlenik u HR modulu',
          'Dodaj specijalizacije (deep tissue, hot stone, facial...) i jezike',
          'Poveži terapeuta s tretmanima koje može raditi',
          'Isključi terapeuta iz dostupnosti jednim klikom (npr. bolovanie ili slobodan dan)',
        ],
      },
      {
        icon: '🚪',
        title: 'Kabine',
        steps: [
          'Idi na Kabine da definišeš prostorije (Kabina 1, Sauna, Hammam, Bazen...)',
          'Svaka kabina ima tip (treatment_room, wet_facility, group...) i kapacitet',
          'Tretmani se automatski mapiraju na kompatibilne kabine',
        ],
      },
      {
        icon: '📅',
        title: 'Kalendar i termini',
        steps: [
          'Spa Calendar prikazuje Gantt po terapeutima — svaki red je terapeut, kolone su vremenski slotovi',
          'Zauzeti termini su prikazani kao obojene trake',
          'Idi na Termini za listu svih termina sa filterima po datumu i statusu',
          'Klikni na termin da vidiš detalje, napomene ili označi no-show',
        ],
      },
      {
        icon: '🌐',
        title: 'Javni booking',
        steps: [
          'Gosti rezerviraju tretmane na rest.by.me/slug/spa',
          'Tok: odabir tretmana → terapeut (opciono) → datum i slobodan termin → plaćanje (folio za hotelske goste, kartica za vanjske)',
          'Hotelski gosti mogu bookirati i direktno iz Guest App-a (tab Spa)',
          'Email potvrda i podsjetnik šalju se automatski',
        ],
      },
      {
        icon: '📊',
        title: 'Spa analitika',
        steps: [
          'Pregled prihoda po tretmanu, utilization rate po terapeutu i no-show stope',
          'Omjer hotelski gosti vs. vanjski gosti',
          'Export u CSV format',
        ],
      },
      {
        icon: '🎁',
        title: 'Paketi',
        steps: [
          'Idi na Paketi da kreirašu kombinirane ponude (npr. Romantic getaway: 2 noći + 2 tretmana)',
          'Paket može uključivati: tip sobe, spa tretmane i opis što je uključeno',
          'Gosti odabiru paket na javnoj spa stranici',
        ],
      },
    ],
    tips: [
      'Buffer između termina (npr. 15 min) obezbjeđuje da terapeut i kabina budu slobodni za pripremu',
      'Folio integracija: spa tretman hotelskog gosta automatski se dodaje na folio',
      'Vidljivost spa linka u guest meniju podešava se u Postavke menija → Vidljivost',
      'Terapeut mora biti zaposlenik u HR modulu da bi se pojavio u listi terapeuta',
      'Javna spa stranica vidljiva je svima — nema potrebe za hotel rezervacijom',
    ],
  },

  // ─────────────────────────────────────────────
  settings: {
    title: 'Postavke — uputstvo',
    intro: 'Osnovni podaci o objektu, logo i upravljanje pretplatom.',
    sections: [
      {
        icon: '🖼️',
        title: 'Logo',
        steps: [
          'Uploadaj logo u JPG, PNG ili WebP formatu (max 2MB)',
          'Logo se prikazuje u guest meniju, admin panelu i email notifikacijama',
          'Preporučen format: kvadratni (1:1), min 200×200px',
          'Bijela ili providna pozadina izgleda najbolje na svim pozadinama',
        ],
      },
      {
        icon: '📋',
        title: 'Osnovni podaci',
        steps: [
          'Unesi naziv objekta, lokaciju, telefon, radno vrijeme i opis',
          'Ovi podaci se prikazuju gostima u guest meniju ispod naziva restorana',
          'Promjene su vidljive gostima odmah po čuvanju',
        ],
      },
      {
        icon: '💳',
        title: 'Pretplata',
        steps: [
          'Pregled trenutnog plana i aktivnih addon modula',
          'Upravljanje pretplatom i naplatom',
          'Addon moduli (Hotel, Spa) aktiviraju se ovdje',
        ],
      },
    ],
    tips: [
      'Postavke vizuelnog izgleda menija (predlošci, boje) nalaze se u Digitalni meni → Postavke menija → Predlošci',
      'Vidljivost funkcija u guest meniju podešava se u Digitalni meni → Postavke menija → Vidljivost',
      'Sajt restorana uređuje se u Digitalni meni → Sajt restorana',
      'Sajt hotela uređuje se u Hotel → Sajt hotela',
    ],
  },
}

export default function ModuleHelp({ moduleKey }) {
  const help = HELP_CONTENT[moduleKey]

  if (!help) return (
    <div className={styles.page}>
      <p className={styles.empty}>Uputstvo za ovaj modul nije dostupno.</p>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{help.title}</h1>
        <p className={styles.intro}>{help.intro}</p>
      </div>

      {help.sections.length > 0 && (
        <div className={styles.sections}>
          {help.sections.map((sec, i) => (
            <div key={i} className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>{sec.icon}</span>
                <h2 className={styles.sectionTitle}>{sec.title}</h2>
              </div>
              <ol className={styles.steps}>
                {sec.steps.map((step, j) => (
                  <li key={j} className={styles.step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {help.tips.length > 0 && (
        <div className={styles.tips}>
          <div className={styles.tipsTitle}>💡 Savjeti</div>
          <ul className={styles.tipsList}>
            {help.tips.map((tip, i) => (
              <li key={i} className={styles.tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
