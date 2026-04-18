// ▶ Zamijeniti: src/platform/admin/TrialBanner.jsx

import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { planStatus, trialDaysLeft } from '../../lib/planUtils'
import styles from './TrialBanner.module.css'

export default function TrialBanner() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  if (!restaurant) return null

  const status = planStatus(restaurant)
  const days = trialDaysLeft(restaurant)

  // Complimentary i aktivni Pro — bez bannera
  if (status === 'complimentary' || status === 'pro') return null

  // Suspendovan nalog
  if (status === 'suspended') {
    return (
      <div className={`${styles.banner} ${styles.bannerDanger}`}>
        <span>⚠️ Nalog je suspendovan zbog neuspješnog plaćanja.</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          Obnovi pretplatu
        </button>
      </div>
    )
  }

  // Trial istekao
  if (status === 'expired') {
    return (
      <div className={`${styles.banner} ${styles.bannerExpired}`}>
        <span>⏰ Trial period je istekao. Pređi na Pro da nastaviš koristiti sve funkcionalnosti.</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          Pređi na Pro →
        </button>
      </div>
    )
  }

  // Trial aktivan — prikaži samo kad ostaje 7 ili manje dana
  if (status === 'trial' && days !== null && days <= 7) {
    return (
      <div className={`${styles.banner} ${styles.bannerTrial}`}>
        <span>🎁 Trial ističe za <strong>{days} {days === 1 ? 'dan' : 'dana'}</strong>.</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          Pređi na Pro →
        </button>
      </div>
    )
  }

  return null
}
