import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import styles from './Auth.module.css'

// Ekran za vlasnika čiji tenant čeka odobrenje superadmina (approval_status != approved).
// Gejtuje se u App.jsx (ApprovalGate) prije AdminLayout-a.
export default function PendingApproval({ status }) {
  const { restaurant, user, logout, loadProfile } = usePlatform()
  const { t } = useTranslation('auth')
  const rejected = status === 'rejected'

  // Polling: dok nalog čeka odobrenje, periodično osvježi profil. Čim ga superadmin
  // odobri, ApprovalGate prestaje da prikazuje ovaj ekran i vlasnik automatski ulazi
  // u panel — bez ručnog re-logina. (Odbijen status se ne mijenja pollingom.)
  const loadRef = useRef(loadProfile)
  loadRef.current = loadProfile
  useEffect(() => {
    if (rejected || !user) return
    const id = setInterval(() => loadRef.current(user), 15000)
    return () => clearInterval(id)
  }, [rejected, user])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>rest.by.me</div>

        {rejected ? (
          <>
            <h1 className={styles.title}>{t('notApprovedTitle')}</h1>
            <p className={styles.sub}>
              {t('notApprovedPre')}<strong>{restaurant?.name}</strong>{t('notApprovedPost')}<a href="mailto:info@restby.me">info@restby.me</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>{t('pendingTitle')}</h1>
            <p className={styles.sub}>
              {t('pendingPre')}<strong>{restaurant?.name}</strong>{t('pendingPost')}
            </p>
            <p className={styles.sub} style={{ marginTop: 12 }}>
              {t('pageActivePre')}<strong>restby.me/{restaurant?.slug}</strong>{t('pageActivePost')}
            </p>
          </>
        )}

        <button className={styles.btn} style={{ marginTop: 20 }} onClick={logout}>
          {t('logout')}
        </button>
        <p className={styles.loginLink} style={{ marginTop: 14 }}>
          {t('questions')} <a href="mailto:info@restby.me">info@restby.me</a>
        </p>
      </div>
    </div>
  )
}
