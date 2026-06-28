import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './HardwareGuide.module.css'

// „Hardver i oprema" — pun vodič po nivoima. Modeli/cijene/linkovi/slike su konstante
// (proper nouns/brojevi → ne prevode se); role i napomene idu kroz i18n. Cijene su
// INDIKATIVNE (hwPricesNote) — validirati lokalno. Slike: hotlink zvaničnih product
// fotografija sa onError fallbackom na emoji (bez commitovanja binarnih fajlova).
// Izvor sadržaja: hardver_vodic.md / hardver_i_platforma_strategija.md.

const AMZ = 'https://www.amazon.com/s?k='

// Slika uređaja sa fallbackom na emoji pločicu ako se ne učita (hotlink/region).
function DeviceImg({ src, emoji }) {
  const [failed, setFailed] = useState(!src)
  if (failed) return <div className={styles.imgFallback}>{emoji}</div>
  return <img className={styles.img} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
}

export default function HardwareGuide() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()

  // Ključne činjenice (umirujuće) — već prevedene poente.
  const facts = [
    { icon: '💻', text: t('hwPoint1') },
    { icon: '🧾', text: t('hwPoint2') },
    { icon: '🖨️', text: t('hwPoint3') },
    { icon: '💳', text: t('hwPoint4') },
  ]

  // Nivoi setupa. dev: { roleKey, emoji, model, price, noteKey, img, link }
  const tiers = [
    {
      nameKey: 'hwTier0Name', descKey: 'hwTier0Desc', badge: '🟢',
      devices: [
        { roleKey: 'hwRoleDevice', emoji: '💻', model: 'Telefon / tablet / laptop', price: '0 €', noteKey: 'hwNoteAnyDevice' },
        { roleKey: 'hwRolePrinter', emoji: '🖨️', model: 'Star TSP143IV (CloudPRNT)', price: '~150–250 €', noteKey: 'hwNoteOptionalPrinter', img: '/hardware/star-tsp143.webp', link: AMZ + 'Star+TSP143IV' },
        { roleKey: 'hwRoleCards', emoji: '💳', model: 'SumUp Solo / Solo Lite · SoftPOS', price: '~30–100 €', noteKey: 'hwNoteCards', img: '/hardware/sumup-solo.png', link: AMZ + 'SumUp+Solo' },
      ],
    },
    {
      nameKey: 'hwTier1Name', descKey: 'hwTier1Desc', badge: '🟡',
      devices: [
        { roleKey: 'hwRoleTerminal', emoji: '🖥️', model: 'Tablet 10"+ ili mini-PC', price: '~150–400 €', noteKey: 'hwNoteTerminal', link: AMZ + 'android+tablet+10+inch' },
        { roleKey: 'hwRolePrinter', emoji: '🖨️', model: 'Star mC-Print3 (CloudPRNT)', price: '~250–350 €', noteKey: 'hwNotePrinterMain', img: '/hardware/star-mcprint3.webp', link: AMZ + 'Star+mC-Print3' },
        { roleKey: 'hwRoleDrawer', emoji: '💰', model: 'Generička RJ11/12 kasa-fioka', price: '~40–80 €', noteKey: 'hwNoteDrawer', link: AMZ + 'POS+cash+drawer+RJ11' },
        { roleKey: 'hwRoleKds', emoji: '🍳', model: 'Tablet 10"+ (ekran kuhinje u app-u)', price: '~150 €', noteKey: 'hwNoteKds', link: AMZ + 'kitchen+display+tablet+stand' },
        { roleKey: 'hwRoleCards', emoji: '💳', model: 'SumUp · terminal · SoftPOS', price: '~0–150 €', noteKey: 'hwNoteCards', img: '/hardware/sumup-solo.png', link: AMZ + 'SumUp+card+reader' },
        { roleKey: 'hwRoleInternet', emoji: '📶', model: 'Ruter + 4G/LTE backup', price: '~30–120 €', noteKey: 'hwNoteInternet', link: AMZ + '4G+LTE+failover+router' },
      ],
    },
    {
      nameKey: 'hwTier2Name', descKey: 'hwTier2Desc', badge: '🔵',
      devices: [
        { roleKey: 'hwRoleReception', emoji: '🖥️', model: 'Računar ili tablet', price: '~300–700 €', noteKey: 'hwNoteReception', link: AMZ + 'mini+pc+desktop' },
        { roleKey: 'hwRolePrinter', emoji: '🖨️', model: 'Star mC-Print3 · Epson TM-m30III', price: '~250–300 €', noteKey: 'hwNotePrinterShare', img: '/hardware/epson-m30.jpg', link: AMZ + 'Epson+TM-m30III' },
        { roleKey: 'hwRoleCards', emoji: '💳', model: 'Terminal ili SoftPOS', price: '~0–200 €', noteKey: 'hwNoteCards', link: AMZ + 'card+payment+terminal' },
        { roleKey: 'hwRoleLocks', emoji: '🔐', model: 'Nuki · TTLock · Igloohome', price: '~80–200 €/vrata', noteKey: 'hwNoteLocks', link: AMZ + 'Nuki+smart+lock' },
        { roleKey: 'hwRoleInternet', emoji: '📶', model: 'Ruter + 4G/LTE backup', price: '~30–120 €', noteKey: 'hwNoteInternet', link: AMZ + '4G+LTE+failover+router' },
      ],
    },
  ]

  const connSteps = [t('hwConn1'), t('hwConn2'), t('hwConn3')]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>🖨️ {t('navHardware')}</h1>
        <p className={styles.intro}>{t('hwIntro')}</p>
      </div>

      <div className={styles.facts}>
        {facts.map((f, i) => (
          <div key={i} className={styles.fact}>
            <span className={styles.factIcon}>{f.icon}</span>
            <span className={styles.factText}>{f.text}</span>
          </div>
        ))}
      </div>

      <p className={styles.pricesNote}>{t('hwPricesNote')}</p>

      {tiers.map(tier => (
        <section key={tier.nameKey} className={styles.tier}>
          <div className={styles.tierHead}>
            <span className={styles.tierBadge}>{tier.badge}</span>
            <div>
              <h2 className={styles.tierName}>{t(tier.nameKey)}</h2>
              <p className={styles.tierDesc}>{t(tier.descKey)}</p>
            </div>
          </div>
          <div className={styles.devGrid}>
            {tier.devices.map((d, i) => (
              <div key={i} className={styles.devCard}>
                <DeviceImg src={d.img} emoji={d.emoji} />
                <div className={styles.devBody}>
                  <div className={styles.devRole}>{t(d.roleKey)}</div>
                  <div className={styles.devModel}>{d.model}</div>
                  <div className={styles.devPrice}>{d.price}</div>
                  <div className={styles.devNote}>{t(d.noteKey)}</div>
                  {d.link && (
                    <a className={styles.devLink} href={d.link} target="_blank" rel="noopener noreferrer">
                      🛒 {t('hwBuyLink')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.conn}>
        <h2 className={styles.connTitle}>{t('hwConnTitle')}</h2>
        <ol className={styles.connList}>
          {connSteps.map((s, i) => <li key={i} className={styles.connStep}>{s}</li>)}
        </ol>
      </section>

      <button className={styles.faqBtn} onClick={() => navigate('/admin/support')}>
        💬 {t('hwFaqCta')}
      </button>
    </div>
  )
}
