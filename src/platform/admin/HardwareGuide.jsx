import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './HardwareGuide.module.css'

// „Hardver i oprema" — lagana verzija (Faza 0). Daje tenantu osnovne odgovore i
// vodi na FAQ; puni vodič po nivoima (printer/fioka/KDS/brave + modeli) razvija se
// poslije validacije konkretnih modela. Izvor sadržaja: hardver_vodic.md.
export default function HardwareGuide() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()

  const points = [
    { icon: '💻', text: t('hwPoint1') },  // bilo koji uređaj sa browserom, bez instalacije
    { icon: '🧾', text: t('hwPoint2') },  // fiskalizacija softverska, nema hardverske kase
    { icon: '🖨️', text: t('hwPoint3') },  // printer cloud/USB, povezivanje iz Postavki
    { icon: '💳', text: t('hwPoint4') },  // kartice SoftPOS ili terminal
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>🖨️ {t('navHardware')}</h1>
        <p className={styles.intro}>{t('hwIntro')}</p>
      </div>

      <div className={styles.points}>
        {points.map((p, i) => (
          <div key={i} className={styles.point}>
            <span className={styles.pointIcon}>{p.icon}</span>
            <span className={styles.pointText}>{p.text}</span>
          </div>
        ))}
      </div>

      <p className={styles.soon}>{t('hwSoon')}</p>

      <button className={styles.faqBtn} onClick={() => navigate('/admin/support')}>
        💬 {t('hwFaqCta')}
      </button>
    </div>
  )
}
