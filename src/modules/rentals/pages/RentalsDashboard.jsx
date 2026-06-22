import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './RentalsDashboard.module.css'

// RENT-0a skelet — kontrolna tabla najma. Stvarne površine (sredstva, kalendar,
// rezervacije) dolaze u narednim inkrementima; ovdje su placeholderi „u izradi".
const PANELS = [
  { key: 'assets',   icon: '🏠', titleKey: 'rdAssets',   descKey: 'rdAssetsDesc',   path: '/admin/rental/assets' },
  { key: 'calendar', icon: '📅', titleKey: 'rdCalendar', descKey: 'rdCalendarDesc', path: '/admin/rental/calendar' },
  { key: 'bookings', icon: '🧾', titleKey: 'rdBookings', descKey: 'rdBookingsDesc', path: '/admin/rental/bookings' },
]

export default function RentalsDashboard() {
  const { t } = useTranslation('admin')
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>🏖️ {t('modRental')}</h1>
        <p className={styles.subtitle}>{t('rdIntro')}</p>
      </div>

      <div className={styles.grid}>
        {PANELS.map(p => (
          <button
            key={p.key}
            className={styles.card}
            disabled={!p.path}
            onClick={() => p.path && navigate(p.path)}
          >
            <div className={styles.cardIcon}>{p.icon}</div>
            <div className={styles.cardBody}>
              <div className={styles.cardName}>{t(p.titleKey)}</div>
              <div className={styles.cardDesc}>{t(p.descKey)}</div>
            </div>
            {!p.path && <span className={styles.soon}>{t('badgeSoon')}</span>}
          </button>
        ))}
      </div>

      <p className={styles.note}>{t('rdBuilding')}</p>
    </div>
  )
}
