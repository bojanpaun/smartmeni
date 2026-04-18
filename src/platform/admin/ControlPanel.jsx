import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { MODULES } from '../../layouts/AdminLayout'
import OnboardingWizard from './OnboardingWizard'
import styles from './ControlPanel.module.css'

export default function ControlPanel() {
  const { restaurant, hasPermission, isOwner, isSuperAdmin } = usePlatform()
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(
    restaurant && !restaurant.onboarding_completed
  )

  const canAccess = (mod) => {
    if (!mod.perm) return true
    return isOwner() || isSuperAdmin() || hasPermission(mod.perm)
  }

  const handleModuleClick = (mod) => {
    if (!mod.active) return
    navigate(mod.path)
  }

  return (
    <div className={styles.page}>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* Pozdrav */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          {restaurant ? `Dobrodošli, ${restaurant.name}` : 'Kontrolna tabla'}
        </h1>
        <p className={styles.subtitle}>Odaberi modul kojim želiš upravljati</p>
      </div>

      {/* Grid modula */}
      <div className={styles.grid}>
        {MODULES.map(mod => {
          const accessible = canAccess(mod)
          return (
            <button
              key={mod.key}
              className={`${styles.card} ${mod.active ? styles.cardActive : styles.cardSoon} ${!accessible ? styles.cardLocked : ''}`}
              onClick={() => handleModuleClick(mod)}
              disabled={!mod.active || !accessible}
            >
              <div className={styles.cardIcon}>{mod.icon}</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{mod.label}</div>
                <div className={styles.cardDesc}>{mod.desc}</div>
              </div>
              <div className={styles.cardStatus}>
                {!accessible
                  ? <span className={`${styles.badge} ${styles.badgeLocked}`}>Nema pristup</span>
                  : mod.active
                  ? <span className={`${styles.badge} ${styles.badgeActive}`}>Aktivan</span>
                  : <span className={`${styles.badge} ${styles.badgeSoon}`}>Uskoro</span>
                }
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}
