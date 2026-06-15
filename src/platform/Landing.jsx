import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
import styles from './Landing.module.css'

/* ──────────────────────────────────────────
   DATA — samo ikone/id-jevi (neprevodivi); tekst živi u `marketing` ns
────────────────────────────────────────── */
const RF_ICONS = ['🍽️', '🔔', '🗺️', '🧑‍🍳', '📊', '🌍']
const HF_ICONS = ['🏨', '📅', '🛎️', '💰', '🧖', '📱']
const BI_ICONS = ['🍽️', '🏨', '🧖', '📱', '👥', '🤝']
const ADDONS = [
  { id: 'hr_pro', icon: '👥' },
  { id: 'inventory_pro', icon: '📦' },
  { id: 'analytics_pro', icon: '📈' },
  { id: 'channel_manager', icon: '🔗', soon: true },
  { id: 'loyalty', icon: '⭐', soon: true },
  { id: 'multi_property', icon: '🏢', soon: true },
]
const STATS = [
  { end: 2, k: 's1' },
  { end: 10, k: 's2' },
  { end: 100, k: 's3' },
  { end: 1, k: 's4' },
]
const NAV_ANCHORS = [
  { href: '#restoran', k: 'restaurant' },
  { href: '#hotel', k: 'hotel' },
  { href: '#addoni', k: 'addons' },
  { href: '#beta', k: 'beta' },
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
  const { t } = useTranslation('marketing')
  const [menuOpen, setMenuOpen] = useState(false)
  const [registerType, setRegisterType] = useState(null)

  const registerHref = registerType
    ? `/registracija?plan=${registerType}`
    : '/registracija'

  return (
    <div className={styles.page}>

      {/* ── BETA TRAKA ── */}
      <div style={{ background: 'var(--ink)', color: '#5dcaa5', textAlign: 'center', padding: '9px 16px', fontSize: 13, fontWeight: 600, letterSpacing: '.01em' }}>
        {t('betaBar')}
      </div>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          rest.by<span>.me</span>
        </a>
        <div className={styles.navLinks}>
          {NAV_ANCHORS.map(a => <a key={a.href} href={a.href}>{t(`nav.${a.k}`)}</a>)}
        </div>
        <div className={styles.navActions}>
          <LanguageSwitcher />
          <a href="/login" className={styles.navLogin}>{t('nav.login')}</a>
          <a href="/registracija" className={styles.navCta}>{t('nav.cta')}</a>
        </div>
        <div className={styles.navMobileActions}>
          <LanguageSwitcher />
          <button className={styles.navBurger} onClick={() => setMenuOpen(v => !v)} aria-label={t('nav.addons')}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV_ANCHORS.map(a => (
            <a key={a.href} href={a.href} onClick={() => setMenuOpen(false)}>{t(`nav.${a.k}`)}</a>
          ))}
          <a href="/login" onClick={() => setMenuOpen(false)}>{t('nav.login')}</a>
          <a href="/registracija" className={styles.mobileMenuCta} onClick={() => setMenuOpen(false)}>{t('nav.cta')}</a>
        </div>
      )}

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>{t('hero.badge')}</div>
            <h1 className={styles.heroTitle}>
              {t('hero.title1')}<br />
              {t('hero.title2')}<br />
              <em>{t('hero.title3')}</em>
            </h1>
            <p className={styles.heroSub}>{t('hero.sub')}</p>
            <div className={styles.heroActions}>
              <a href="/registracija" className={styles.btnPrimary}>{t('hero.ctaPrimary')}</a>
              <a href="#restoran" className={styles.btnGhost}>{t('hero.ctaGhost')}</a>
            </div>
            <div className={styles.heroTrust}>
              <div className={styles.trustPills}>
                <span className={styles.trustPill}>{t('hero.trust1')}</span>
                <span className={styles.trustPill}>{t('hero.trust2')}</span>
                <span className={styles.trustPill}>{t('hero.trust3')}</span>
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
                <div className={styles.heroCardTitle}>{t('demo.frontDesk')}</div>
                <div className={styles.heroCardRoom}>
                  <span>101 · Marković</span><span className={styles.roomIn}>{t('demo.checkin')}</span>
                </div>
                <div className={styles.heroCardRoom}>
                  <span>204 · Jovović</span><span className={styles.roomClean}>{t('demo.cleaning')}</span>
                </div>
                <div className={styles.heroCardRoom}>
                  <span>312 · Petrić</span><span className={styles.roomOut}>{t('demo.checkout')}</span>
                </div>
                <div className={styles.heroCardStat}>
                  <div><div className={styles.statNum}>82%</div><div className={styles.statLab}>{t('demo.occupancy')}</div></div>
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
                <div className={styles.heroCardTitle}>{t('demo.menu')}</div>
                <div className={styles.heroMenuItem}>
                  <span>🥗</span>
                  <span className={styles.heroMenuName}>{t('demo.dish1')}</span>
                  <span className={styles.heroMenuPrice}>4.50€</span>
                </div>
                <div className={styles.heroMenuItem}>
                  <span>🐟</span>
                  <span className={styles.heroMenuName}>{t('demo.dish2')}</span>
                  <span className={styles.heroMenuPrice}>16€</span>
                </div>
                <div className={styles.heroMenuItem}>
                  <span>🦑</span>
                  <span className={styles.heroMenuName}>{t('demo.dish3')}</span>
                  <span className={styles.heroMenuPrice}>8€</span>
                </div>
                <button className={styles.heroMenuWaiter}>{t('demo.waiter')}</button>
              </div>
            </div>

            <div className={styles.floatNotif}>
              <span className={styles.floatNotifIcon}>📈</span>
              <div>
                <div className={styles.floatNotifTitle}>{t('demo.notifTitle')}</div>
                <div className={styles.floatNotifSub}>{t('demo.notifSub')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className={styles.stats}>
        <div className={styles.statsGrid}>
          {STATS.map((s) => (
            <div key={s.k} className={styles.stat}>
              <div className={styles.statNum}><CountUp end={s.end} suffix={t(`stats.${s.k}suf`)} /></div>
              <div className={styles.statLabel}>{t(`stats.${s.k}lab`)}</div>
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
                {t('rest.badge')}
              </div>
              <h2 className={styles.sectionTitle}>
                {t('rest.title1')}<br />
                {t('rest.title2')}
              </h2>
              <p className={styles.sectionSub}>{t('rest.sub')}</p>
              <a href="/registracija?plan=restoran" className={styles.btnPrimary}>{t('rest.cta')}</a>
            </div>
            <div className={styles.featGrid}>
              {RF_ICONS.map((icon, i) => (
                <div key={i} className={styles.featCard}>
                  <div className={styles.featIcon}>{icon}</div>
                  <div className={styles.featTitle}>{t(`rf.${i + 1}.t`)}</div>
                  <div className={styles.featDesc}>{t(`rf.${i + 1}.d`)}</div>
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
                {t('hot.badge')}
              </div>
              <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLight}`}>
                {t('hot.title1')}<br />
                {t('hot.title2')}
              </h2>
              <p className={`${styles.sectionSub} ${styles.sectionSubLight}`}>{t('hot.sub')}</p>
              <a href="/registracija?plan=hotel" className={styles.btnAccent}>{t('hot.cta')}</a>
            </div>
            <div className={styles.featGrid}>
              {HF_ICONS.map((icon, i) => (
                <div key={i} className={`${styles.featCard} ${styles.featCardDark}`}>
                  <div className={styles.featIcon}>{icon}</div>
                  <div className={styles.featTitle}>{t(`hf.${i + 1}.t`)}</div>
                  <div className={`${styles.featDesc} ${styles.featDescDark}`}>{t(`hf.${i + 1}.d`)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ADDONI ── */}
      <section className={styles.addonsSection} id="addoni">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>{t('addons.label')}</div>
          <h2 className={styles.sectionTitle}>{t('addons.title')}</h2>
          <p className={styles.sectionSub}>{t('addons.sub')}</p>
          <div className={styles.addonsGrid}>
            {ADDONS.map((a, i) => (
              <div key={a.id} className={`${styles.addonCard} ${a.soon ? styles.addonCardSoon : ''}`}>
                <div className={styles.addonIcon}>{a.icon}</div>
                <div className={styles.addonInfo}>
                  <div className={styles.addonTitle}>
                    {t(`ad.${i + 1}.t`)}
                    {a.soon && <span className={styles.soonBadge}>{t('addons.soon')}</span>}
                  </div>
                  <div className={styles.addonDesc}>{t(`ad.${i + 1}.d`)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BETA ── */}
      <section className={styles.addonsSection} id="beta">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>{t('beta.label')}</div>
          <h2 className={styles.sectionTitle}>
            {t('beta.title1')}<br />{t('beta.title2')}
          </h2>
          <p className={styles.sectionSub}>
            {t('beta.subPre')}<strong>{t('beta.subStrong')}</strong>{t('beta.subPost')}
          </p>

          <div className={styles.featGrid} style={{ marginTop: 32 }}>
            {BI_ICONS.map((icon, i) => (
              <div key={i} className={styles.featCard}>
                <div className={styles.featIcon}>{icon}</div>
                <div className={styles.featTitle}>{t(`bi.${i + 1}.t`)}</div>
                <div className={styles.featDesc}>{t(`bi.${i + 1}.d`)}</div>
              </div>
            ))}
          </div>

          <div className={styles.addonsNote} style={{ marginTop: 28 }}>
            {t('beta.notePre')}<a href="mailto:info@restby.me">info@restby.me</a>
          </div>
        </div>
      </section>

      {/* ── CTA / REGISTRACIJA ── */}
      <section className={styles.ctaSection} id="registracija">
        <div className={styles.ctaInner}>
          <div className={styles.sectionLabel} style={{ color: '#5dcaa5' }}>{t('cta.label')}</div>
          <h2 className={styles.ctaTitle}>
            {t('cta.title1')}<br />{t('cta.title2')}
          </h2>
          <p className={styles.ctaSub}>{t('cta.sub')}</p>

          <div className={styles.typeSelector}>
            {[
              { key: 'restoran', lk: 'restLabel', sk: 'restSub' },
              { key: 'hotel', lk: 'hotelLabel', sk: 'hotelSub' },
              { key: 'hotel_pro', lk: 'bothLabel', sk: 'bothSub' },
            ].map(opt => (
              <button
                key={opt.key}
                className={`${styles.typeBtn} ${registerType === opt.key ? styles.typeBtnActive : ''}`}
                onClick={() => setRegisterType(opt.key)}
              >
                <span className={styles.typeBtnLabel}>{t(`types.${opt.lk}`)}</span>
                <span className={styles.typeBtnSub}>{t(`types.${opt.sk}`)}</span>
              </button>
            ))}
          </div>

          <a href={registerHref} className={styles.ctaRegisterBtn}>{t('cta.registerBtn')}</a>

          <div className={styles.ctaNote}>{t('cta.note')}</div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer} id="kontakt">
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            rest.by<span>.me</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="mailto:info@restby.me">info@restby.me</a>
            <a href="/login">{t('footer.login')}</a>
            <a href="#">{t('footer.privacy')}</a>
            <a href="#">{t('footer.terms')}</a>
          </div>
          <div className={styles.footerCopy}>{t('footer.copy')}</div>
        </div>
      </footer>

    </div>
  )
}
