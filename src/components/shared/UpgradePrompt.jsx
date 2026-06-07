import { useNavigate } from 'react-router-dom'
import styles from './UpgradePrompt.module.css'

const CATEGORY_LABEL = {
  restaurant: 'Restoran',
  hotel: 'Hotel',
  enterprise: 'Enterprise',
}

export default function UpgradePrompt({
  addonId,
  name,
  description,
  features = [],
  price,
  category,
  dependsOn = [],
  fullPage = false,
}) {
  const navigate = useNavigate()

  return (
    <div className={`${styles.container} ${fullPage ? styles.fullPage : ''}`}>
      <div className={styles.lockIcon}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {category && (
        <span className={`${styles.categoryBadge} ${styles[`category_${category}`]}`}>
          {CATEGORY_LABEL[category] ?? category}
        </span>
      )}

      <h2 className={styles.title}>{name}</h2>
      <p className={styles.description}>{description}</p>

      {features.length > 0 && (
        <ul className={styles.featureList}>
          {features.map(f => (
            <li key={f} className={styles.featureItem}>
              <span className={styles.featureCheck}>✓</span>{f}
            </li>
          ))}
        </ul>
      )}

      {dependsOn.length > 0 && (
        <p className={styles.dependsNote}>
          Zahtijeva: <strong>{dependsOn.join(', ')}</strong>
        </p>
      )}

      <div className={styles.priceRow}>
        {price ? (
          <>
            <span className={styles.priceAmount}>od {price}€</span>
            <span className={styles.pricePeriod}>/godišnje</span>
          </>
        ) : (
          <span className={styles.priceTbd}>Cijena na upit</span>
        )}
      </div>

      <button
        className={styles.ctaBtn}
        onClick={() => navigate('/admin/billing')}
      >
        Aktiviraj modul
      </button>

      <p className={styles.trialNote}>14 dana besplatno probno razdoblje</p>
    </div>
  )
}
