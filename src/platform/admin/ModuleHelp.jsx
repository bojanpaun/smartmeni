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
        title: 'QR kod',
        steps: [
          'Idi na tab QR kod',
          'Odštampaj QR kod i zalijepite na svaki sto',
          'Gosti skeniraju i meni se odmah otvara na telefonu',
          'Možeš kopirati direktan link i podijeliti ga',
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
    intro: 'Upravljanje mapom stolova i rezervacijama. Ovaj modul je trenutno u razvoju.',
    sections: [
      {
        icon: '🪑',
        title: 'Mapa stolova',
        steps: ['Drag & drop raspored stolova', 'Realtime status svakog stola', 'Pregled narudžbi po stolu'],
      },
    ],
    tips: ['Modul će biti dostupan uskoro.'],
  },

  inventory: {
    title: 'Zalihe — uputstvo',
    intro: 'Upravljanje inventarom, dobavljačima i evidencijom nabavki. Ovaj modul je trenutno u razvoju.',
    sections: [],
    tips: ['Modul će biti dostupan uskoro.'],
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
