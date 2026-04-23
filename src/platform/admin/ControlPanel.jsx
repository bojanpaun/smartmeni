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

  const functionalModules = MODULES.filter(m => !m.adminOnly)
  const adminModules = MODULES.filter(m => m.adminOnly)

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

      {/* Funkcionalni moduli */}
      <div className={styles.grid}>
        {functionalModules.map(mod => {
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

      {/* Administrativne postavke */}
      {(isOwner() || isSuperAdmin()) && (
        <>
          <div className={styles.adminSectionTitle}>Administrativne postavke</div>
          <div className={`${styles.grid} ${styles.gridAdmin}`}>
            <button
              className={`${styles.card} ${styles.cardAdmin} ${styles.cardActive}`}
              onClick={() => navigate('/admin/staff/roles')}
            >
              <div className={styles.cardIcon}>🔑</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>Role i permisije</div>
                <div className={styles.cardDesc}>Upravljanje rolama i pristupima osoblja</div>
              </div>
            </button>
            {adminModules.map(mod => {
              const accessible = canAccess(mod)
              return (
                <button
                  key={mod.key}
                  className={`${styles.card} ${styles.cardAdmin} ${mod.active ? styles.cardActive : styles.cardSoon} ${!accessible ? styles.cardLocked : ''}`}
                  onClick={() => handleModuleClick(mod)}
                  disabled={!mod.active || !accessible}
                >
                  <div className={styles.cardIcon}>{mod.icon}</div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{mod.label}</div>
                    <div className={styles.cardDesc}>{mod.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
