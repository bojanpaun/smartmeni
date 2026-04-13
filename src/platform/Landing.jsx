import { useState, useEffect, useRef } from 'react'
import styles from './Landing.module.css'

const FEATURES = [
  {
    icon: '📸',
    title: 'Slike jela',
    desc: 'Svako jelo sa fotografijom. Gosti jedu očima — vizuelni meni povećava narudžbe.'
  },
  {
    icon: '⚡',
    title: 'Instant ažuriranje',
    desc: 'Promijenite cijenu ili sakrije jelo za sekunde. Bez štampanja, bez čekanja.'
  },
  {
    icon: '🌍',
    title: 'Dvojezičnost',
    desc: 'Crnogorski i engleski jezik. Strani turisti snalaze se sami.'
  },
  {
    icon: '🔔',
    title: 'Poziv konobara',
    desc: 'Gost klikne — konobar dobija notifikaciju. Nema više mahanja rukom.'
  },
  {
    icon: '📱',
    title: 'Mobile first',
    desc: 'Dizajniran za telefon. Savršen prikaz na svakom ekranu, bez aplikacije.'
  },
  {
    icon: '📊',
    title: 'Analitika',
    desc: 'Vidite koja jela gosti najviše gledaju. Optimizujte ponudu na osnovu podataka.'
  },
]

const TESTIMONIALS = [
  {
    name: 'Nikola Petrović',
    role: 'Vlasnik, Kafana Stari Grad · Podgorica',
    text: 'Za jedan dan smo postavili meni i odmah vidjeli razliku. Gosti su oduševljeni, a mi štedimo na štampi.',
    initial: 'N',
  },
  {
    name: 'Maja Đurović',
    role: 'Menadžer, Restoran Ribar · Budva',
    text: 'Turisti sada sami pregledaju meni na engleskom. Konobarima je puno lakše, a narudžbe su porasle.',
    initial: 'M',
  },
  {
    name: 'Stefan Vukić',
    role: 'Vlasnik, Caffe Bar Central · Bar',
    text: 'Postavljanje je trajalo 20 minuta. Cijeli meni, slike, cijene — sve online. I potpuno besplatno.',
    initial: 'S',
  },
]

const MENU_DEMO = {
  categories: ['Predjela', 'Riba', 'Meso', 'Piće', 'Deserti'],
  items: [
    { emoji: '🥗', name: 'Grčka salata', desc: 'Feta, masline, krastavac', price: '4.50€', bg: '#e0f5ec', tag: 'Popularno', tagColor: '#0d7a52', tagBg: '#e0f5ec' },
    { emoji: '🦑', name: 'Lignje na žaru', desc: 'Sa limunom i začinima', price: '8.00€', bg: '#faeee8', tag: 'Predjela', tagColor: '#7a3d1a', tagBg: '#faeee8' },
    { emoji: '🐟', name: 'Brancin na žaru', desc: 'Svježi, sa kaparima', price: '16.00€', bg: '#e8f0fa', tag: 'Riba', tagColor: '#1a3d7a', tagBg: '#e8f0fa' },
  ]
}

function PhoneMockup() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className={styles.phone}>
      <div className={styles.phoneHeader}>
        <div className={styles.phoneRestInfo}>
          <div className={styles.phoneRestLogo}>R</div>
          <div>
            <div className={styles.phoneRestName}>Restoran Ribar</div>
            <div className={styles.phoneRestMeta}>⭐ 4.9 · Budva</div>
          </div>
        </div>
        <div className={styles.phoneLang}>SR / EN</div>
      </div>

      <div className={styles.phoneTabs}>
        {MENU_DEMO.categories.map((cat, i) => (
          <button
            key={cat}
            className={`${styles.phoneTab} ${activeTab === i ? styles.phoneTabActive : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.phoneItems}>
        {MENU_DEMO.items.map((item, i) => (
          <div key={i} className={styles.phoneItem}>
            <div className={styles.phoneItemEmoji} style={{ background: item.bg }}>
              {item.emoji}
            </div>
            <div className={styles.phoneItemBody}>
              <div className={styles.phoneItemName}>{item.name}</div>
              <div className={styles.phoneItemDesc}>{item.desc}</div>
              <div className={styles.phoneItemFooter}>
                <span className={styles.phoneItemPrice}>{item.price}</span>
                <span
                  className={styles.phoneItemTag}
                  style={{ background: item.tagBg, color: item.tagColor }}
                >
                  {item.tag}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className={styles.phoneWaiter}>
        🔔 Pozovi konobara
      </button>
    </div>
  )
}

function CountUp({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * end))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count}{suffix}</span>
}

export default function Landing() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <div className={styles.page}>

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          smart<span>meni</span>
          <span className={styles.navDot}>.me</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#kako-radi">Kako radi</a>
          <a href="#funkcije">Funkcije</a>
          <a href="#cijene">Cijene</a>
          <a href="#kontakt">Kontakt</a>
        </div>
        <a href="#registracija" className={styles.navCta}>
          Kreni besplatno
        </a>
        <button className={styles.navBurger} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <a href="#kako-radi" onClick={() => setMenuOpen(false)}>Kako radi</a>
          <a href="#funkcije" onClick={() => setMenuOpen(false)}>Funkcije</a>
          <a href="#cijene" onClick={() => setMenuOpen(false)}>Cijene</a>
          <a href="#kontakt" onClick={() => setMenuOpen(false)}>Kontakt</a>
          <a href="#registracija" className={styles.mobileMenuCta} onClick={() => setMenuOpen(false)}>Kreni besplatno</a>
        </div>
      )}

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={`${styles.heroBadge} animate-fade-up`}>
            🇲🇪 Besplatno za sve restorane u Crnoj Gori
          </div>
          <h1 className={`${styles.heroTitle} animate-fade-up animate-fade-up-delay-1`}>
            Digitalni meni koji<br />
            <em>zaista prodaje</em>
          </h1>
          <p className={`${styles.heroSub} animate-fade-up animate-fade-up-delay-2`}>
            Moderan QR meni za vaš restoran, kafanu ili caffe bar.
            Bez papira, bez aplikacije, bez komplikacija.
            Gost skenira — meni se otvara.
          </p>
          <div className={`${styles.heroActions} animate-fade-up animate-fade-up-delay-3`}>
            <a href="#registracija" className={styles.btnPrimary}>
              Registruj restoran besplatno
            </a>
            <a href="#demo" className={styles.btnGhost}>
              Pogledaj demo →
            </a>
          </div>
          <div className={`${styles.heroTrust} animate-fade-up animate-fade-up-delay-4`}>
            <div className={styles.trustAvatars}>
              {['N','M','S','A','D'].map((l, i) => (
                <div key={i} className={styles.trustAvatar} style={{ zIndex: 5 - i }}>
                  {l}
                </div>
              ))}
            </div>
            <span>Već <strong>50+</strong> restorana koristi SmartMeni</span>
          </div>
        </div>
        <div className={`${styles.heroVisual} animate-fade-up animate-fade-up-delay-2`}>
          <div className={styles.phoneWrap}>
            <PhoneMockup />
          </div>
          <div className={styles.floatCard1}>
            <span className={styles.floatCardIcon}>🔔</span>
            <div>
              <div className={styles.floatCardTitle}>Sto 4 · Konobar</div>
              <div className={styles.floatCardSub}>Zahtjev primljen</div>
            </div>
          </div>
          <div className={styles.floatCard2}>
            <div className={styles.floatCardTitle}>📈 +23% pregleda</div>
            <div className={styles.floatCardSub}>Ove sedmice</div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className={styles.stats}>
        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <div className={styles.statNum}><CountUp end={50} suffix="+" />  </div>
            <div className={styles.statLabel}>Restorana u Crnoj Gori</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><CountUp end={12000} suffix="+" /></div>
            <div className={styles.statLabel}>Pregleda menija mjesečno</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><CountUp end={3} suffix=" sek" /></div>
            <div className={styles.statLabel}>Prosječno učitavanje</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}><CountUp end={100} suffix="%" /></div>
            <div className={styles.statLabel}>Besplatno za početak</div>
          </div>
        </div>
      </section>

      {/* KAKO RADI */}
      <section className={styles.howSection} id="kako-radi">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Kako radi</div>
          <h2 className={styles.sectionTitle}>Od registracije do QR koda<br />za 10 minuta</h2>
          <div className={styles.steps}>
            {[
              { n: '01', title: 'Registrujte se', desc: 'Napravite nalog za vaš restoran za 2 minute. Potpuno besplatno, bez kreditne kartice.' },
              { n: '02', title: 'Unesite meni', desc: 'Dodajte jela, opise, slike i cijene kroz jednostavan admin panel. Može i sa telefona.' },
              { n: '03', title: 'Odštampajte QR', desc: 'Preuzmite QR kod i zalijepite na svaki sto. Gosti skeniraju i meni se otvara.' },
              { n: '04', title: 'Ažurirajte u sekundi', desc: 'Promijenite cijenu, sakrijte jelo, dodajte dnevnu ponudu — odmah vidljivo gostima.' },
            ].map((step, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{step.n}</div>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepDesc}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.featSection} id="funkcije">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Funkcije</div>
          <h2 className={styles.sectionTitle}>Sve što vaš meni treba</h2>
          <div className={styles.featGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} className={styles.featCard}>
                <div className={styles.featIcon}>{f.icon}</div>
                <div className={styles.featTitle}>{f.title}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className={styles.demoSection} id="demo">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Demo</div>
          <h2 className={styles.sectionTitle}>Ovako izgleda vaš meni<br />na telefonu gosta</h2>
          <p className={styles.sectionSub}>
            Skenirajte QR kod ili posjetite <strong>smartmeni.me/demo</strong> da vidite pravi primjer.
          </p>
          <div className={styles.demoCentered}>
            <PhoneMockup />
            <div className={styles.demoQr}>
              <div className={styles.demoQrBox}>
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="2" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                  <rect x="10" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                  <rect x="52" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                  <rect x="60" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                  <rect x="2" y="52" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                  <rect x="10" y="60" width="10" height="10" rx="1" fill="currentColor"/>
                  <rect x="36" y="2" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="36" y="14" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="36" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="48" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="60" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="72" y="36" width="6" height="8" rx="1" fill="currentColor"/>
                  <rect x="36" y="48" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="48" y="48" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="60" y="52" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="36" y="62" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="48" y="62" width="8" height="8" rx="1" fill="currentColor"/>
                  <rect x="60" y="66" width="18" height="8" rx="1" fill="currentColor"/>
                </svg>
              </div>
              <div className={styles.demoQrLabel}>smartmeni.me/demo</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className={styles.testSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Iskustva</div>
          <h2 className={styles.sectionTitle}>Šta kažu vlasnici restorana</h2>
          <div className={styles.testGrid}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={styles.testCard}>
                <div className={styles.testText}>"{t.text}"</div>
                <div className={styles.testAuthor}>
                  <div className={styles.testAvatar}>{t.initial}</div>
                  <div>
                    <div className={styles.testName}>{t.name}</div>
                    <div className={styles.testRole}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricingSection} id="cijene">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Cijene</div>
          <h2 className={styles.sectionTitle}>Počnite besplatno.<br />Plaćajte samo storage.</h2>
          <p className={styles.sectionSub}>
            Naš biznis model je jednostavan: vi koristite platformu besplatno, a ako trebate više prostora za slike,
            godišnja pretplata iznosi cijenu jedne kafe.
          </p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingName}>Starter</div>
              <div className={styles.pricingPrice}>€0<span>/zauvijek</span></div>
              <div className={styles.pricingDesc}>Sve što je potrebno za početak.</div>
              <ul className={styles.pricingFeatures}>
                <li>Do 40 stavki menija</li>
                <li>QR kod za svaki sto</li>
                <li>Crnogorski + engleski</li>
                <li>Slike do 100MB</li>
                <li>Poziv konobara</li>
                <li>Osnovna analitika</li>
              </ul>
              <a href="#registracija" className={styles.pricingBtn}>Kreni besplatno</a>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.pricingBadge}>Najpopularniji</div>
              <div className={styles.pricingName}>Pro</div>
              <div className={styles.pricingPrice}>€19<span>/godišnje</span></div>
              <div className={styles.pricingDesc}>Za restorane sa bogatom ponudom i slikama.</div>
              <ul className={styles.pricingFeatures}>
                <li>Neograničene stavke</li>
                <li>Neograničen storage za slike</li>
                <li>Napredna analitika</li>
                <li>Specijalne i dnevne ponude</li>
                <li>Prioritetna podrška</li>
                <li>Prilagođeni branding</li>
              </ul>
              <a href="#registracija" className={`${styles.pricingBtn} ${styles.pricingBtnPrimary}`}>Uzmi Pro plan</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / REGISTRACIJA */}
      <section className={styles.ctaSection} id="registracija">
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>
            Vaš meni je jedan QR<br />kod od gosta
          </h2>
          <p className={styles.ctaSub}>
            Registrujte se za 2 minute. Meni postavljate sami.
            Mi smo tu ako zatreba pomoć.
          </p>
          {!submitted ? (
            <form className={styles.ctaForm} onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Naziv restorana"
                className={styles.ctaInput}
                required
              />
              <input
                type="email"
                placeholder="Vaš email"
                className={styles.ctaInput}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <button type="submit" className={styles.ctaSubmit}>
                Registruj se besplatno →
              </button>
            </form>
          ) : (
            <div className={styles.ctaSuccess}>
              ✓ Hvala! Kontaktiraćemo vas u roku od 24 sata.
            </div>
          )}
          <div className={styles.ctaNote}>
            Bez kreditne kartice · Bez obaveza · Besplatno zauvijek
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer} id="kontakt">
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            smart<span>meni</span><span className={styles.footerDot}>.me</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="mailto:info@smartmeni.me">info@smartmeni.me</a>
            <a href="#">Privatnost</a>
            <a href="#">Uslovi korišćenja</a>
          </div>
          <div className={styles.footerCopy}>
            © 2025 SmartMeni · Podgorica, Crna Gora
          </div>
        </div>
      </footer>

    </div>
  )
}
