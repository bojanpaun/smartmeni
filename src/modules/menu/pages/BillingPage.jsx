// ▶ Zamijeniti: src/modules/menu/pages/BillingPage.jsx

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { planStatus, trialDaysLeft } from '../../../lib/planUtils'
import styles from './BillingPage.module.css'

const PLANS = {
  starter: {
    name: 'Starter',
    price: 'Besplatno',
    features: [
      'Do 30 stavki menija',
      'QR kod za svaki sto',
      'Poziv konobara',
      'Osnovna analitika',
    ],
    missing: [
      'Neograničene stavke i slike',
      'Napredna analitika',
      'Predlošci i brending',
      'Prioritetna podrška',
    ],
  },
  pro: {
    name: 'Pro',
    price: '€19/god',
    features: [
      'Neograničene stavke i slike',
      'Napredna analitika i izvještaji',
      'Predlošci i brending',
      'Upload loga',
      'Digitalno naručivanje',
      'Prioritetna podrška',
      'QR kod za svaki sto',
    ],
    missing: [],
  },
}

export default function BillingPage() {
  const { restaurant, setRestaurant } = usePlatform()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const status = planStatus(restaurant)
  const days = trialDaysLeft(restaurant)
  const currentPlan = restaurant?.plan || 'starter'
  const isPro = status === 'pro' || status === 'complimentary'
  const isSuspendedStatus = status === 'suspended'

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nisi prijavljen')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_KEY,
          },
          body: JSON.stringify({
            return_url: `${window.location.origin}/admin/billing/success`,
            cancel_url: `${window.location.origin}/admin/billing`,
          }),
        }
      )

      const data = await res.json()

      if (data.approve_url) {
        window.location.href = data.approve_url
      } else {
        setError('Greška pri kreiranju pretplate. Pokušaj ponovo.')
      }
    } catch (err) {
      setError('Greška pri povezivanju sa PayPal-om.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Da li si siguran da želiš otkazati Pro pretplatu?')) return
    alert('Za otkazivanje pretplate kontaktiraj podršku na support@smartmeni.me')
  }

  // ── Complimentary prikaz ────────────────────────────────────
  if (status === 'complimentary') {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pretplata i naplata</h1>
          <p className={styles.subtitle}>Upravljaj planom i pretplatom restorana.</p>
        </div>
        <div className={styles.complimentaryCard}>
          <div className={styles.complimentaryIcon}>🎁</div>
          <div className={styles.complimentaryTitle}>Besplatni Pro pristup</div>
          <div className={styles.complimentaryDesc}>
            Vaš nalog ima aktiviran besplatni Pro pristup sa svim funkcionalnostima.
            {restaurant?.complimentary_note && (
              <div className={styles.complimentaryNote}>
                Napomena: {restaurant.complimentary_note}
              </div>
            )}
          </div>
          <div className={styles.complimentaryFeatures}>
            <span>✓ Neograničene stavke</span>
            <span>✓ Svi predlošci</span>
            <span>✓ Upload loga</span>
            <span>✓ Digitalno naručivanje</span>
            <span>✓ Napredna analitika</span>
            <span>✓ Prioritetna podrška</span>
          </div>
        </div>
      </div>
    )
  }
  // ────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pretplata i naplata</h1>
        <p className={styles.subtitle}>Upravljaj planom i pretplatom restorana.</p>
      </div>

      {/* Status alertovi */}
      {isSuspendedStatus && (
        <div className={styles.alertDanger}>
          ⚠️ Nalog je suspendovan zbog neuspješnog plaćanja. Obnovi pretplatu da nastaviš koristiti SmartMeni.
        </div>
      )}

      {status === 'trial' && days !== null && days > 0 && (
        <div className={styles.alertTrial}>
          🎁 Trial period — ostalo ti je <strong>{days} dana</strong> besplatnog Pro pristupa.
        </div>
      )}

      {status === 'expired' && (
        <div className={styles.alertExpired}>
          ⏰ Trial period je istekao. Pređi na Pro da nastaviš koristiti sve funkcionalnosti.
        </div>
      )}

      {/* Planovi */}
      <div className={styles.plans}>

        {/* Starter */}
        <div className={`${styles.planCard} ${currentPlan === 'starter' && !isSuspendedStatus ? styles.planCurrent : ''}`}>
          <div className={styles.planHeader}>
            <div className={styles.planName}>Starter</div>
            <div className={styles.planPrice}>Besplatno</div>
            <div className={styles.planPeriod}>zauvijek</div>
          </div>
          <ul className={styles.featureList}>
            {PLANS.starter.features.map(f => (
              <li key={f} className={styles.featureItem}>
                <span className={styles.featureCheck}>✓</span> {f}
              </li>
            ))}
            {PLANS.starter.missing.map(f => (
              <li key={f} className={`${styles.featureItem} ${styles.featureMissing}`}>
                <span className={styles.featureCross}>✗</span> {f}
              </li>
            ))}
          </ul>
          {currentPlan === 'starter' && !isSuspendedStatus && (
            <div className={styles.currentBadge}>Trenutni plan</div>
          )}
        </div>

        {/* Pro */}
        <div className={`${styles.planCard} ${styles.planPro} ${currentPlan === 'pro' ? styles.planCurrent : ''}`}>
          <div className={styles.planPopular}>Preporučeno</div>
          <div className={styles.planHeader}>
            <div className={styles.planName}>Pro</div>
            <div className={styles.planPrice}>€19</div>
            <div className={styles.planPeriod}>godišnje</div>
          </div>
          <ul className={styles.featureList}>
            {PLANS.pro.features.map(f => (
              <li key={f} className={styles.featureItem}>
                <span className={styles.featureCheck}>✓</span> {f}
              </li>
            ))}
          </ul>

          {currentPlan === 'pro' ? (
            <div className={styles.proActions}>
              <div className={styles.currentBadge} style={{ background: '#e0f5ec', color: '#0d7a52' }}>
                ✓ Aktivan Pro plan
              </div>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                Otkaži pretplatu
              </button>
            </div>
          ) : (
            <button
              className={styles.upgradeBtn}
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? 'Preusmjeravanje...' : '🅿 Plati putem PayPal-a'}
            </button>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>

      </div>

      {/* FAQ */}
      <div className={styles.faq}>
        <div className={styles.faqTitle}>Često postavljana pitanja</div>
        <div className={styles.faqItem}>
          <div className={styles.faqQ}>Šta se dešava kad trial istekne?</div>
          <div className={styles.faqA}>Prelazite na Starter plan — podaci se čuvaju, ali neke funkcije postaju nedostupne.</div>
        </div>
        <div className={styles.faqItem}>
          <div className={styles.faqQ}>Mogu li otkazati pretplatu?</div>
          <div className={styles.faqA}>Da, možete otkazati u bilo kom trenutku. Plan ostaje aktivan do kraja plaćenog perioda.</div>
        </div>
        <div className={styles.faqItem}>
          <div className={styles.faqQ}>Da li se podaci brišu?</div>
          <div className={styles.faqA}>Ne — podaci se nikad ne brišu. Ako obnovite pretplatu, sve je dostupno kao i ranije.</div>
        </div>
      </div>
    </div>
  )
}
