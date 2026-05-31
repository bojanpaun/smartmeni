import { useState, useEffect, useRef } from 'react'
import styles from './Landing.module.css'

/* ──────────────────────────────────────────
   DATA
────────────────────────────────────────── */
const RESTAURANT_FEATURES = [
  { icon: '🍽️', title: 'Digitalni QR meni', desc: 'Moderan meni dostupan skeniranjem. Bez aplikacije, radi odmah na svakom telefonu.' },
  { icon: '🔔', title: 'Waiter zahtjevi', desc: 'Gost klikne dugme — konobar dobija notifikaciju na svom uređaju.' },
  { icon: '🗺️', title: 'Mapa stolova', desc: 'Vizuelna mapa stolova sa statusima u realnom vremenu za cijeli restoran.' },
  { icon: '🧑‍🍳', title: 'Kitchen dashboard', desc: 'Kuhinja prati narudžbe uživo, po prioritetu i statusu.' },
  { icon: '📊', title: 'Analitika menija', desc: 'Koji artikli se najviše pregledaju, kada su špicevi, koji jezici dominiraju.' },
  { icon: '🌍', title: 'Višejezičnost', desc: 'Crnogorski + engleski u osnovnom paketu. Turisti se snalaze sami.' },
]

const HOTEL_FEATURES = [
  { icon: '🏨', title: 'Front desk', desc: 'Check-in, check-out, status soba i rezervacija na jednom ekranu.' },
  { icon: '📅', title: 'Rezervacije i kalendar', desc: 'Booking engine sa kalendarom zauzetosti i folio sistemom po gostu.' },
  { icon: '🛎️', title: 'Housekeeping', desc: 'Taskovi za osoblje, status čišćenja, prioriteti — sve u realnom vremenu.' },
  { icon: '💰', title: 'Revenue management', desc: 'Dinamičke cijene, RevPAR, yield management i occupancy analitika.' },
  { icon: '🧖', title: 'Spa & Wellness', desc: 'Booking tretmana, kalendar terapeuta, kapaciteti i folio integracija.' },
  { icon: '📱', title: 'Guest App', desc: 'Mobilna aplikacija za goste — narudžbe, booking, info o hotelu.' },
]

const ADDONS = [
  { id: 'hr_pro', icon: '👥', title: 'HR Pro', desc: 'Raspored, prisustvo, platni spiskovi za svo osoblje.' },
  { id: 'inventory_pro', icon: '📦', title: 'Inventar Pro', desc: 'Zalihe, recepture, FIFO rotacija, upozorenja.' },
  { id: 'analytics_pro', icon: '📈', title: 'Analitika Pro', desc: 'Napredni izvještaji, export PDF/Excel, prilagođeni periodi.' },
  { id: 'channel_manager', icon: '🔗', title: 'Channel Manager', desc: 'Sync sa Booking.com, Airbnb, Expedia — uskoro.', soon: true },
  { id: 'loyalty', icon: '⭐', title: 'Loyalty', desc: 'Bodovi, tier sistem, redemption za goste — uskoro.', soon: true },
  { id: 'multi_property', icon: '🏢', title: 'Multi-property', desc: 'Upravljanje više objekata jednim nalogom — uskoro.', soon: true },
]

const TESTIMONIALS = [
  {
    name: 'Nikola Petrović',
    role: 'Vlasnik, Kafana Stari Grad · Podgorica',
    text: 'Digitalni meni smo postavili za jedan dan. Gosti su oduševljeni, konobarima je lakše, a štampanje smo potpuno izbacili.',
    initial: 'N', type: 'restaurant',
  },
  {
    name: 'Milena Vukčević',
    role: 'Direktorica, Hotel Perla · Boka Kotorska',
    text: 'Front desk, housekeeping i rezervacije na jednoj platformi. Revenue management nam je pomogao da povećamo cijene u špicu za 22%.',
    initial: 'M', type: 'hotel',
  },
  {
    name: 'Stefan Radović',
    role: 'Vlasnik, Resort Biogradska · Kolašin',
    text: 'Koristimo i hotel i restoran modul. Minibar narudžbe idu direktno na folio. Ovo je ono što smo godinama tražili.',
    initial: 'S', type: 'both',
  },
]

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 0,
    annual: 0,
    desc: 'Za objekat koji želi da isprobá digitalni meni bez ikakvog rizika.',
    features: ['✓ Digitalni QR meni', '✓ Do 30 stavki', '✓ 1 QR kod', '✓ Crnogorski jezik', '✓ Bez kreditne kartice'],
    cta: 'Počni besplatno',
    featured: false,
  },
  {
    key: 'restoran',
    name: 'Restoran',
    monthly: 29,
    annual: 23,
    desc: 'Kompletan restoranski sistem sa stolovima, narudžbama i analitikom.',
    features: ['✓ Neograničene stavke menija', '✓ QR kodovi za svaki sto', '✓ Mapa stolova + waiter zahtjevi', '✓ Kitchen dashboard', '✓ Osnovna analitika', '✓ Evidencija osoblja'],
    cta: 'Probaj besplatno',
    featured: false,
  },
  {
    key: 'hotel',
    name: 'Hotel',
    monthly: 79,
    annual: 63,
    desc: 'Kompletan hotel management sa booking engine i revenue managementom.',
    features: ['✓ Sobe, tipovi, rezervacije', '✓ Front desk + Folio sistem', '✓ Online Booking engine', '✓ Housekeeping dashboard', '✓ Revenue management', '✓ Spa & Wellness modul', '✓ Guest App'],
    cta: 'Probaj besplatno',
    featured: true,
    badge: 'Najpopularnije',
  },
  {
    key: 'hotel_pro',
    name: 'Hotel Pro',
    monthly: 119,
    annual: 95,
    desc: 'Hotel + Restoran u jednom. Minibar narudžbe na folio, dijeljeni gosti.',
    features: ['✓ Sve iz Hotel plana', '✓ Restoran modul uključen', '✓ Minibar → folio integracija', '✓ Zajednička baza gostiju', '✓ Dijeljeni inventar'],
    cta: 'Probaj besplatno',
    featured: false,
  },
]

/* ──────────────────────────────────────────
   HELPERS
────────────────────────────────────────── */
function CountUp({ end, suffix = '', duration = 1800 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count}{suffix}</span>
}

/* ──────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────── */
export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [annual, setAnnual] = useState(false)
  const [registerType, setRegisterType] = useState(null)

  const registerHref = registerType
    ? `/registracija?plan=${registerType}`
    : '/registracija'

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          rest.by<span>.me</span>
        </a>
        <div className={styles.navLinks}>
          <a href="#restoran">Restoran</a>
          <a href="#hotel">Hotel</a>
          <a href="#addoni">Addoni</a>
          <a href="#cijene">Cijene</a>
        </div>
        <div className={styles.navActions}>
          <a href="/login" className={styles.navLogin}>Prijava</a>
          <a href="/registracija" className={styles.navCta}>Počni besplatno</a>
        </div>
        <button className={styles.navBurger} onClick={() => setMenuOpen(v => !v)} aria-label="Meni">
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {['#restoran', '#hotel', '#addoni', '#cijene'].map((href, i) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {['Restoran', 'Hotel', 'Addoni', 'Cijene'][i]}
            </a>
          ))}
          <a href="/login" onClick={() => setMenuOpen(false)}>Prijava</a>
          <a href="/registracija" className={styles.mobileMenuCta} onClick={() => setMenuOpen(false)}>Počni besplatno</a>
        </div>
      )}

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>🇲🇪 Hospitality platforma za Crnu Goru</div>
            <h1 className={styles.heroTitle}>
              Upravljajte hotelom<br />
              i restoranom<br />
              <em>s jednog mjesta</em>
            </h1>
            <p className={styles.heroSub}>
              Jedna platforma za digitalni meni, rezervacije,
              front desk, housekeeping, HR i analitiku.
              Nema više žongliranja sa deset sistema.
            </p>
            <div className={styles.heroActions}>
              <a href="/registracija" className={styles.btnPrimary}>
                Počni besplatno
              </a>
              <a href="#restoran" className={styles.btnGhost}>
                Pogledaj module →
              </a>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.trustPills}>
                <span className={styles.trustPill}>✓ Starter plan besplatan</span>
                <span className={styles.trustPill}>✓ 14 dana trial</span>
                <span className={styles.trustPill}>✓ Lokalna podrška</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroCards}>
              <div className={`${styles.heroCard} ${styles.heroCardHotel}`}>
                <div className={styles.heroCardHeader}>
                  <span className={styles.heroCardDot} style={{background:'#5dcaa5'}}/>
                  <span className={styles.heroCardDot} style={{background:'#fac775'}}/>
                  <span className={styles.heroCardDot} style={{background:'#f09595'}}/>
                </div>
                <div className={styles.heroCardTitle}>Front Desk</div>
                <div className={styles.heroCardRoom}>
                  <span>101 · Marković</span><span className={styles.roomIn}>Check-in</span>
                </div>
                <div className={styles.heroCardRoom}>
                  <span>204 · Jovović</span><span className={styles.roomClean}>Čišćenje</span>
                </div>
                <div className={styles.heroCardRoom}>
                  <span>312 · Petrić</span><span className={styles.roomOut}>Check-out</span>
                </div>
                <div className={styles.heroCardStat}>
                  <div><div className={styles.statNum}>82%</div><div className={styles.statLab}>Popunjenost</div></div>
                  <div><div className={styles.statNum}>€94</div><div className={styles.statLab}>ADR</div></div>
                  <div><div className={styles.statNum}>€77</div><div className={styles.statLab}>RevPAR</div></div>
                </div>
              </div>

              <div className={`${styles.heroCard} ${styles.heroCardMenu}`}>
                <div className={styles.heroCardHeader}>
                  <span className={styles.heroCardDot} style={{background:'#5dcaa5'}}/>
                  <span className={styles.heroCardDot} style={{background:'#fac775'}}/>
                  <span className={styles.heroCardDot} style={{background:'#f09595'}}/>
                </div>
                <div className={styles.heroCardTitle}>Digitalni meni</div>
                <div className={styles.heroMenuItem}>
                  <span>🥗</span>
                  <span className={styles.heroMenuName}>Grčka salata</span>
                  <span className={styles.heroMenuPrice}>4.50€</span>
                </div>
                <div className={styles.heroMenuItem}>
                  <span>🐟</span>
                  <span className={styles.heroMenuName}>Brancin na žaru</span>
                  <span className={styles.heroMenuPrice}>16€</span>
                </div>
                <div className={styles.heroMenuItem}>
                  <span>🦑</span>
                  <span className={styles.heroMenuName}>Lignje na žaru</span>
                  <span className={styles.heroMenuPrice}>8€</span>
                </div>
                <button className={styles.heroMenuWaiter}>🔔 Pozovi konobara</button>
              </div>
            </div>

            <div className={styles.floatNotif}>
              <span className={styles.floatNotifIcon}>📈</span>
              <div>
                <div className={styles.floatNotifTitle}>+22% prihod</div>
                <div className={styles.floatNotifSub}>Ova sezona vs prošla</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className={styles.stats}>
        <div className={styles.statsGrid}>
          {[
            { end: 50, suffix: '+', label: 'objekata u Crnoj Gori' },
            { end: 12000, suffix: '+', label: 'pregleda menija/mj' },
            { end: 14, suffix: ' dana', label: 'besplatnog triala' },
            { end: 1, suffix: ' platforma', label: 'za hotel i restoran' },
          ].map((s, i) => (
            <div key={i} className={styles.stat}>
              <div className={styles.statNum}><CountUp end={s.end} suffix={s.suffix} /></div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RESTORAN MODUL ── */}
      <section className={styles.moduleSection} id="restoran">
        <div className={styles.sectionInner}>
          <div className={styles.moduleSplit}>
            <div className={styles.moduleInfo}>
              <div className={styles.sectionBadge} style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}>
                Restoran verticala
              </div>
              <h2 className={styles.sectionTitle}>
                Od digitalnog menija<br />
                do kompletnog POS sistema
              </h2>
              <p className={styles.sectionSub}>
                Digitalni QR meni, mapa stolova, waiter zahtjevi,
                kitchen dashboard i analitika u jednom paketu.
                Radi kao standalone restoranski sistem ili
                integrisano sa hotelskim foliom.
              </p>
              <div className={styles.modulePrice}>
                <span className={styles.modulePriceFrom}>od</span>
                <span className={styles.modulePriceNum}>€29</span>
                <span className={styles.modulePricePer}>/mj</span>
              </div>
              <a href="/registracija?plan=restoran" className={styles.btnPrimary}>
                Probaj restoran modul
              </a>
            </div>
            <div className={styles.featGrid}>
              {RESTAURANT_FEATURES.map((f, i) => (
                <div key={i} className={styles.featCard}>
                  <div className={styles.featIcon}>{f.icon}</div>
                  <div className={styles.featTitle}>{f.title}</div>
                  <div className={styles.featDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOTEL MODUL ── */}
      <section className={styles.moduleSection} id="hotel" style={{ background: 'var(--ink)' }}>
        <div className={styles.sectionInner}>
          <div className={`${styles.moduleSplit} ${styles.moduleSplitReverse}`}>
            <div className={styles.moduleInfo} style={{ color: 'white' }}>
              <div className={styles.sectionBadge} style={{ background: 'rgba(93,202,165,0.15)', color: '#5dcaa5' }}>
                Hotel verticala
              </div>
              <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLight}`}>
                Kompletan hotel<br />
                management sistem
              </h2>
              <p className={`${styles.sectionSub} ${styles.sectionSubLight}`}>
                Front desk, rezervacije, housekeeping, revenue
                management i Spa & Wellness. Online booking engine
                direktno sa vaše hotel stranice — bez provizija.
              </p>
              <div className={styles.modulePrice}>
                <span className={styles.modulePriceFrom} style={{ color: '#5dcaa5' }}>od</span>
                <span className={styles.modulePriceNum} style={{ color: 'white' }}>€79</span>
                <span className={styles.modulePricePer} style={{ color: '#8a9e96' }}>/mj</span>
              </div>
              <a href="/registracija?plan=hotel" className={styles.btnAccent}>
                Probaj hotel modul
              </a>
            </div>
            <div className={styles.featGrid}>
              {HOTEL_FEATURES.map((f, i) => (
                <div key={i} className={`${styles.featCard} ${styles.featCardDark}`}>
                  <div className={styles.featIcon}>{f.icon}</div>
                  <div className={styles.featTitle}>{f.title}</div>
                  <div className={`${styles.featDesc} ${styles.featDescDark}`}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ADDONI ── */}
      <section className={styles.addonsSection} id="addoni">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Operativni addoni</div>
          <h2 className={styles.sectionTitle}>
            Dijeljeni servisi za oba vertikala
          </h2>
          <p className={styles.sectionSub}>
            HR, inventar i analitika rade podjednako za restoransko i hotelsko osoblje.
            Aktivirate samo ono što vam treba.
          </p>
          <div className={styles.addonsGrid}>
            {ADDONS.map((a) => (
              <div key={a.id} className={`${styles.addonCard} ${a.soon ? styles.addonCardSoon : ''}`}>
                <div className={styles.addonIcon}>{a.icon}</div>
                <div className={styles.addonInfo}>
                  <div className={styles.addonTitle}>
                    {a.title}
                    {a.soon && <span className={styles.soonBadge}>Uskoro</span>}
                  </div>
                  <div className={styles.addonDesc}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className={styles.testSection}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Iskustva</div>
          <h2 className={styles.sectionTitle}>Šta kažu naši korisnici</h2>
          <div className={styles.testGrid}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={styles.testCard}>
                <div className={styles.testType}>
                  {t.type === 'restaurant' && <span className={styles.typePill} style={{ background:'var(--green-light)', color:'var(--green-dark)' }}>Restoran</span>}
                  {t.type === 'hotel' && <span className={styles.typePill} style={{ background:'#e8f4f0', color:'#0d5c3e' }}>Hotel</span>}
                  {t.type === 'both' && <span className={styles.typePill} style={{ background:'#faeeda', color:'#7a4a0a' }}>Hotel + Restoran</span>}
                </div>
                <p className={styles.testText}>„{t.text}"</p>
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

      {/* ── PRICING ── */}
      <section className={styles.pricingSection} id="cijene">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Cijene</div>
          <h2 className={styles.sectionTitle}>Transparentno. Bez iznenađenja.</h2>
          <p className={styles.sectionSub}>
            Počnite besplatno. Nadogradite kad ste spremni.
            14 dana probnog perioda bez kreditne kartice.
          </p>

          <div className={styles.annualToggle}>
            <span>Mjesečno</span>
            <label className={styles.annualSwitch}>
              <input type="checkbox" checked={annual} onChange={e => setAnnual(e.target.checked)} />
              <span className={styles.annualSlider} />
            </label>
            <span>Godišnje</span>
            <span className={styles.annualSave}>Ušteda ~20%</span>
          </div>

          <div className={styles.pricingGrid}>
            {PLANS.map((plan) => (
              <div key={plan.key} className={`${styles.pricingCard} ${plan.featured ? styles.pricingCardFeatured : ''}`}>
                {plan.badge && <div className={styles.pricingBadge}>{plan.badge}</div>}
                <div className={styles.pricingName}>{plan.name}</div>
                <div className={styles.pricingPrice}>
                  {plan.monthly === 0
                    ? 'Besplatno'
                    : <>€{annual ? plan.annual : plan.monthly}<span>/mj</span></>
                  }
                </div>
                <div className={styles.pricingAnnual}>
                  {annual && plan.annual > 0
                    ? `€${plan.annual * 12}/god — ušteda €${(plan.monthly - plan.annual) * 12}`
                    : plan.monthly > 0
                    ? `ili €${plan.annual}/mj godišnje`
                    : ''
                  }
                </div>
                <div className={styles.pricingDesc}>{plan.desc}</div>
                <ul className={styles.pricingFeatures}>
                  {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <a
                  href={`/registracija?plan=${plan.key}`}
                  className={`${styles.pricingBtn} ${plan.featured ? styles.pricingBtnPrimary : ''}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <div className={styles.addonsNote}>
            <strong>Operativni addoni</strong> (HR Pro, Inventar Pro, Analitika Pro) naplaćuju se zasebno
            i rade za oba vertikala. Pogledajte detalje u <a href="#addoni">sekciji Addoni</a>.
          </div>
        </div>
      </section>

      {/* ── CTA / REGISTRACIJA ── */}
      <section className={styles.ctaSection} id="registracija">
        <div className={styles.ctaInner}>
          <div className={styles.sectionLabel} style={{ color: '#5dcaa5' }}>Počni danas</div>
          <h2 className={styles.ctaTitle}>
            14 dana probnog perioda.<br />Bez kreditne kartice.
          </h2>
          <p className={styles.ctaSub}>
            Odaberite šta koristite i registrujte se za 2 minute.
          </p>

          <div className={styles.typeSelector}>
            {[
              { key: 'starter', label: '🎁 Starter', sub: 'Besplatno' },
              { key: 'restoran', label: '🍽️ Restoran', sub: 'od €29/mj' },
              { key: 'hotel', label: '🏨 Hotel', sub: 'od €79/mj' },
              { key: 'hotel_pro', label: '🏨🍽️ Hotel Pro', sub: 'od €119/mj' },
            ].map(opt => (
              <button
                key={opt.key}
                className={`${styles.typeBtn} ${registerType === opt.key ? styles.typeBtnActive : ''}`}
                onClick={() => setRegisterType(opt.key)}
              >
                <span className={styles.typeBtnLabel}>{opt.label}</span>
                <span className={styles.typeBtnSub}>{opt.sub}</span>
              </button>
            ))}
          </div>

          <a href={registerHref} className={styles.ctaRegisterBtn}>
            Registruj se besplatno →
          </a>

          <div className={styles.ctaNote}>
            Bez kreditne kartice · 14 dana trial · Otkazivanje u bilo kom trenutku
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer} id="kontakt">
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            rest.by<span>.me</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="mailto:info@rest.by.me">info@rest.by.me</a>
            <a href="/login">Prijava</a>
            <a href="#">Privatnost</a>
            <a href="#">Uslovi korišćenja</a>
          </div>
          <div className={styles.footerCopy}>
            © 2025 rest.by.me · Podgorica, Crna Gora
          </div>
        </div>
      </footer>

    </div>
  )
}
