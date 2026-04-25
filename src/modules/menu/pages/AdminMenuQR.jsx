// src/modules/menu/pages/AdminMenuQR.jsx
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'
import menuStyles from './AdminMenu.module.css'

export default function AdminMenuQR() {
  const { restaurant } = usePlatform()

  if (!restaurant) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>QR kod</h1>
        <p className={styles.subtitle}>Podijelite link ili odštampajte QR kod za stolove.</p>
      </div>
      <div className={menuStyles.card}>
        <div className={menuStyles.cardTitle}>Vaš QR kod i link</div>
        <div className={menuStyles.qrSection}>
          <div className={styles.qrBox}>
            <div className={styles.qrPlaceholder}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <rect x="2" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="10" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                <rect x="52" y="2" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="60" y="10" width="10" height="10" rx="1" fill="currentColor"/>
                <rect x="2" y="52" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="3" fill="none"/>
                <rect x="10" y="60" width="10" height="10" rx="1" fill="currentColor"/>
                <rect x="36" y="2" width="8" height="8" rx="1" fill="currentColor"/>
                <rect x="36" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                <rect x="48" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                <rect x="60" y="36" width="8" height="8" rx="1" fill="currentColor"/>
                <rect x="36" y="48" width="8" height="8" rx="1" fill="currentColor"/>
                <rect x="48" y="62" width="8" height="8" rx="1" fill="currentColor"/>
              </svg>
            </div>
            <div className={styles.qrLabel}>{restaurant.name}</div>
          </div>
          <div className={styles.qrInfo}>
            <div className={styles.qrUrlLabel}>Link za goste</div>
            <div className={styles.qrUrl}>
              <span>smartmeni.me/{restaurant.slug}</span>
              <button onClick={() => navigator.clipboard.writeText(`https://smartmeni.me/${restaurant.slug}`)}>
                Kopiraj
              </button>
            </div>
            <p className={styles.qrNote}>
              Odštampajte QR kod i zalijepite na svaki sto. Gosti skeniraju i meni se odmah otvara na telefonu.
            </p>
            <a
              href={`/${restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className={styles.viewBtn}
            >
              Otvori meni →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
