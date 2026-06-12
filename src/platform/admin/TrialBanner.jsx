// ▶ Zamijeniti: src/platform/admin/TrialBanner.jsx

import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { planStatus, trialDaysLeft } from '../../lib/planUtils'
import styles from './TrialBanner.module.css'

export default function TrialBanner() {
  const { restaurant, betaMode } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  if (!restaurant) return null

  // Beta period — svi moduli besplatni. Ima prednost nad naplata-banerima
  // (trial/expired/suspended) jer se tokom bete ništa ne naplaćuje.
  if (betaMode) {
    return (
      <div className={`${styles.banner} ${styles.bannerBeta}`}>
        <span>🧪 <strong>{t('tbBetaStrong')}</strong>{t('tbBetaRest')}</span>
      </div>
    )
  }

  const status = planStatus(restaurant)
  const days = trialDaysLeft(restaurant)

  // Complimentary i aktivni Pro — bez bannera
  if (status === 'complimentary' || status === 'pro') return null

  // Suspendovan nalog
  if (status === 'suspended') {
    return (
      <div className={`${styles.banner} ${styles.bannerDanger}`}>
        <span>{t('tbSuspended')}</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          {t('tbRenew')}
        </button>
      </div>
    )
  }

  // Trial istekao
  if (status === 'expired') {
    return (
      <div className={`${styles.banner} ${styles.bannerExpired}`}>
        <span>{t('tbExpired')}</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          {t('tbToPro')} →
        </button>
      </div>
    )
  }

  // Trial aktivan — prikaži samo kad ostaje 7 ili manje dana
  if (status === 'trial' && days !== null && days <= 7) {
    return (
      <div className={`${styles.banner} ${styles.bannerTrial}`}>
        <span>{t('tbTrialEndsPre')}<strong>{days} {days === 1 ? t('tbDay') : t('tbDays')}</strong>{t('tbTrialEndsDot')}</span>
        <button className={styles.bannerBtn} onClick={() => navigate('/admin/billing')}>
          {t('tbToPro')} →
        </button>
      </div>
    )
  }

  return null
}
