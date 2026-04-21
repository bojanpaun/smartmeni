import styles from './ModuleHelp.module.css'

// Uputstva po modulima — dodaj novi modul ovdje
const HELP_CONTENT = {
  menu: {
    title: 'Digitalni meni — uputstvo',
    intro: 'Ovaj modul omogućava upravljanje digitalnim menijem vašeg restorana. Gosti skeniraju QR kod i otvaraju meni na svom telefonu.',
    sections: [
      {
        icon: '🗂️',
        title: 'Kategorije',
        steps: [
          'Idi na tab Meni',
          'Klikni + Kategorija da dodaš novu kategoriju (npr. Predjela, Riba, Piće)',
          'Svaka kategorija dobija emoji ikonu i naziv',
        ],
      },
      {
        icon: '🍽️',
        title: 'Dodavanje jela',
        steps: [
          'Odaberi kategoriju u koju dodaješ jelo',
          'Klikni + Dodaj jelo',
          'Popuni naziv, opis, cijenu i po želji dodaj sliku',
          'Možeš označiti jelo kao Dnevnu ponudu',
        ],
      },
      {
        icon: '📱',
        title: 'QR kod restorana',
        steps: [
          'Idi na tab QR kod',
          'Ovaj QR vodi na generalni meni restorana — bez informacije o stolu',
          'Koristi ga na ulazu, jelovniku, vizit karti ili društvenim mrežama',
          'Odštampaj i podijeli link smartmeni.me/vas-slug',
        ],
      },
      {
        icon: '🧾',
        title: 'Narudžbe',
        steps: [
          'U sekciji Narudžbe pratiš sve narudžbe u realtime-u',
          'Status narudžbe: primljeno → priprema → gotovo → serviranje',
          'Zahtjevi konobara se prikazuju odmah kad gost pritisne dugme',
        ],
      },
    ],
    tips: [
      'Postoje dva različita QR koda — generalni (ovaj tab) i QR po stolu (modul Stolovi)',
      'QR po stolu omogućava praćenje s kojeg stola dolazi narudžba — preporučujemo ga za svakodnevno korišćenje',
      'Gosti vide samo jela označena kao vidljiva (toggle dugme u tabeli)',
      'Dnevna ponuda se ističe posebno na vrhu menija',
      'Promjene u meniju su vidljive gostima odmah',
    ],
  },

  staff: {
    title: 'Osoblje — uputstvo',
    intro: 'Ovaj modul omogućava upravljanje zaposlenima i njihovim pristupom sistemu putem rola i permisija.',
    sections: [
      {
        icon: '👤',
        title: 'Pozivanje zaposlenika',
        steps: [
          'Klikni + Pozovi zaposlenika',
          'Unesi email adresu',
          'Odaberi rolu (Konobar, Kuhinja, Menadžer, Šank)',
          'Zaposlenik prima email s pozivom i kreira nalog',
        ],
      },
      {
        icon: '🔑',
        title: 'Role i permisije',
        steps: [
          'Svaka rola ima skup permisija (šta može vidjeti i raditi)',
          'Možeš kreirati custom rolu sa tačno onim permisijama koje trebaš',
          'Predlošci: Konobar, Kuhinja, Menadžer, Šank — prilagodi po potrebi',
        ],
      },
      {
        icon: '🔒',
        title: 'Sigurnost pristupa',
        steps: [
          'Zaposleni vide samo module za koje imaju permisiju',
          'Vlasnik restorana ima puni pristup svemu',
          'Permisije možeš mijenjati u bilo kom trenutku',
        ],
      },
    ],
    tips: [
      'Konobar tipično treba: vidjeti meni, narudžbe i zahtjeve',
      'Kuhinja treba: vidjeti narudžbe i mijenjati status (priprema/gotovo)',
      'Menadžer može vidjeti analitiku i upravljati osobljem',
    ],
  },

  tables: {
    title: 'Stolovi — uputstvo',
    intro: 'Ovaj modul omogućava crtanje mape stolova, praćenje statusa u realnom vremenu i upravljanje rezervacijama.',
    sections: [
      {
        icon: '🗺️',
        title: 'Crtanje mape stolova',
        steps: [
          'Idi na Mapa stolova',
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
          'Idi na Prikaz konobara za realtime pregled svih stolova',
          'Slobodni stolovi su bijeli, zauzeti narandžasti, a plavi su rezervisani',
          'Crveni sto sa animacijom znači da gost zove konobara',
          'Klikni na sto da vidiš aktivne narudžbe i ukupan račun',
          'Stranica se automatski osvježava bez potrebe za refreshom',
        ],
      },
      {
        icon: '📅',
        title: 'Rezervacije',
        steps: [
          'Idi na Rezervacije da upravljaš rezervacijama',
          'Klikni + Nova rezervacija i popuni podatke gosta',
          'Na mapi unutar forme klikni na sto da ga vizuelno odabereš',
          'Koristi Kalendar prikaz da vidiš koji dani su zauzeti',
          'Klikni na dan u kalendaru da filtriiraš listu za taj dan',
        ],
      },
      {
        icon: '🌐',
        title: 'Online rezervacije',
        steps: [
          'U sekciji Rezervacije uključi toggle Online rezervacije',
          'Gosti mogu slati zahtjeve na: smartmeni.me/vas-slug/rezervacija',
          'Svaki zahtjev ima status Na čekanju dok ga ne odobriš',
          'Klikni Potvrdi ili Odbij na svakom zahtjevu',
          'Potvrđene rezervacije se automatski prikazuju na mapi konobara',
        ],
      },
      {
        icon: '📱',
        title: 'QR kodovi po stolu',
        steps: [
          'Klikni na sto u editoru, a zatim na dugme QR kod',
          'Ovaj QR je drugačiji od generalnog QR-a u Digitalnom meniju',
          'Svaki sto ima jedinstveni QR koji vodi na meni sa brojem stola (npr. smartmeni.me/slug?table=3)',
          'Preuzmi QR i odštampaj ga — zalijepite na svaki sto posebno',
          'Kad gost skenira QR i pozove konobara, konobar vidi tačno koji sto zove',
        ],
      },
    ],
    tips: [
      'Mapa se čuva automatski — gosti i konobar odmah vide promjene',
      'Jedan sto može imati više rezervacija u toku dana — konobar vidi sve termine u badge-u',
      'Rezervisani stolovi se prikazuju plavom bojom sa vremenima na mapi konobara',
    ],
  },

  inventory: {
    title: 'Zalihe — uputstvo',
    intro: 'Ovaj modul prati namirnice i gotove proizvode, bilježi ulaze i izlaze, i automatski odbija zalihe kad se narudžba primi.',
    sections: [
      {
        icon: '📦',
        title: 'Dodavanje stavki inventara',
        steps: [
          'Idi na Inventar i klikni + Nova stavka',
          'Unesi naziv (npr. Brašno T-500), kategoriju i jedinicu mjere',
          'Postavi trenutnu količinu i minimalnu količinu',
          'Minimalna količina je prag ispod kojeg se prikazuje upozorenje',
          'Opcionalno unesi cijenu po jedinici za praćenje troškova',
        ],
      },
      {
        icon: '±',
        title: 'Ručni pokreti zaliha',
        steps: [
          'Klikni ± dugme pored stavke za ručni ulaz ili izlaz',
          'Ulaz — dodaje količinu na zalihu (npr. nova dostava)',
          'Izlaz — oduzima količinu sa zalihe (npr. rashod)',
          'Korekcija — direktno postavlja novu količinu (inventura)',
          'Svaki pokret se bilježi u istoriji Pokreti',
        ],
      },
      {
        icon: '🧪',
        title: 'Recepture',
        steps: [
          'Idi na Recepture da definišeš koje namirnice troši svako jelo',
          'Odaberi stavku menija s lijeve strane',
          'Dodaj sastojke i odredi količinu po porciji',
          'Npr. Pizza Margherita: 200g brašna, 150ml sosa, 100g mozzarelle',
          'Kad se narudžba primi, zalihe se automatski odbijaju prema recepturi',
        ],
      },
      {
        icon: '⚠️',
        title: 'Upozorenja za niske zalihe',
        steps: [
          'Stavke ispod minimalne količine imaju narandžast indikator',
          'U headeru se prikazuje broj stavki ispod minimuma',
          'Klikni filter Niske zalihe da vidiš samo te stavke',
          'Ažuriraj količinu putem ± dugmeta kad stignu nove zalihe',
        ],
      },
      {
        icon: '📋',
        title: 'Istorija pokreta',
        steps: [
          'Idi na Pokreti za kompletnu istoriju ulaza i izlaza',
          'Filtriraj po stavci, tipu pokreta ili datumu',
          'Automatski pokreti od narudžbi imaju oznaku Narudžba',
          'Ručni pokreti imaju oznaku Ručno',
        ],
      },
    ],
    tips: [
      'Automatski odbitak radi samo ako su definisane recepture za stavke menija',
      'Korekcija je korisna za usklađivanje stanja nakon fizičke inventure',
      'Postavljanje minimalne količine na 0 isključuje upozorenja za tu stavku',
      'Cijena po jedinici nije obavezna, ali pomaže pri praćenju troškova nabavke',
    ],
  },

  analytics: {
    title: 'Analitika — uputstvo',
    intro: 'Pregled prometa, najprodavanijih jela i detaljnih izvještaja. Ovaj modul je trenutno u razvoju.',
    sections: [],
    tips: ['Modul će biti dostupan uskoro.'],
  },

  settings: {
    title: 'Postavke — uputstvo',
    intro: 'Opšte postavke restorana, logo, boja brenda i digitalno naručivanje.',
    sections: [
      {
        icon: '🎨',
        title: 'Brending',
        steps: [
          'Postavi boju brenda — koristi se u zaglavlju guest menija',
          'Upload loga (uskoro)',
          'Naziv i kontakt podaci restorana',
        ],
      },
    ],
    tips: ['Promjene su odmah vidljive na guest meniju.'],
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
