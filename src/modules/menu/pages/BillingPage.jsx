import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { planStatus, trialDaysLeft, PLAN_PRICING, ANNUAL_DISCOUNT } from '../../../lib/planUtils'
import styles from './BillingPage.module.css'

// ── Plan definicije ───────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    color: '#6b7280',
    desc: 'Sve što treba za digitalni meni',
    features: [
      'Neograničene stavke menija',
      'QR kod i poziv konobara',
      'Digitalno naručivanje',
      'Upravljanje stolovima',
      'Osnovna analitika',
      'Staff portal',
      'Gost profil',
    ],
  },
  {
    id: 'restaurant',
    name: 'Restoran',
    color: '#0d7a52',
    desc: 'Profesionalni alati za restoran',
    features: [
      'Sve iz Starter',
      'Napredna analitika i izvještaji',
      'HR Pro — payroll, rasporedi',
      'Upravljanje zalihama',
      'Loyalty program',
      'Restoran sajt',
      'Prioritetna podrška',
    ],
    paypal: true,
  },
  {
    id: 'hotel',
    name: 'Hotel',
    color: '#2563eb',
    popular: true,
    desc: 'Kompletno upravljanje hotelom',
    features: [
      'Sve iz Restoran',
      'Sobe, rezervacije, front desk',
      'Online booking engine',
      'Housekeeping modul',
      'Revenue management',
      'Guest App (/:slug/guest)',
      'Hotel sajt',
    ],
    comingSoon: true,
  },
  {
    id: 'hotel_pro',
    name: 'Hotel Pro',
    color: '#7c3aed',
    desc: 'Hotel sa Spa & Wellness centrom',
    features: [
      'Sve iz Hotel',
      'Spa & Wellness modul',
      'Spa booking za goste',
      'Email podsjetnici (pg_cron)',
    ],
    comingSoon: true,
  },
]

const PLAN_ORDER = ['starter', 'restaurant', 'hotel', 'hotel_pro']

export default function BillingPage() {
  const { restaurant, subscription, setSubscription } = usePlatform()
  const [cycle, setCycle] = useState('annual') // 'monthly' | 'annual'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const status = planStatus(restaurant)
  const days   = trialDaysLeft(restaurant)
  const currentPlan = (() => {
    const p = restaurant?.plan || 'starter'
    return p === 'pro' ? 'restaurant' : p
  })()

  const price = (planId) => {
    if (planId === 'starter') return null
    const p = PLAN_PRICING[planId]
    if (!p) return null
    return cycle === 'annual'
      ? { main: p.annual_per_month, sub: `€${p.annual_total}/god`, save: true }
      : { main: p.monthly, sub: '/mj', save: false }
  }

  const handlePayPal = async () => {
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
            plan: 'restaurant',
            billing_cycle: cycle,
            return_url: `${window.location.origin}/admin/billing/success`,
            cancel_url:  `${window.location.origin}/admin/billing`,
          }),
        }
      )
      const data = await res.json()
      if (data.approve_url) window.location.href = data.approve_url
      else throw new Error(data.error ?? 'Greška pri kreiranju pretplate')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Complimentary ────────────────────────────────────────────
  if (status === 'complimentary') return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pretplata i naplata</h1>
      </div>
      <div className={styles.complimentaryCard}>
        <div className={styles.complimentaryIcon}>🎁</div>
        <div className={styles.complimentaryTitle}>Besplatni Pro pristup</div>
        <div className={styles.complimentaryDesc}>
          Vaš nalog ima aktiviran besplatni pristup sa svim funkcionalnostima.
          {restaurant?.complimentary_note && (
            <div className={styles.complimentaryNote}>{restaurant.complimentary_note}</div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pretplata i naplata</h1>
        <p className={styles.subtitle}>Odaberi plan koji odgovara tvom objektu.</p>
      </div>

      {/* Status alertovi */}
      {status === 'suspended' && (
        <div className={styles.alertDanger}>
          ⚠️ Nalog je suspendovan. Obnovi pretplatu da nastaviš koristiti SmartMeni.
        </div>
      )}
      {status === 'trial' && days > 0 && (
        <div className={styles.alertTrial}>
          🎁 Trial — ostalo ti je <strong>{days} dana</strong> besplatnog pristupa.
        </div>
      )}
      {status === 'expired' && (
        <div className={styles.alertExpired}>
          ⏰ Trial je istekao. Odaberi plan da nastaviš sa svim funkcionalnostima.
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className={styles.cycleToggleWrap}>
        <div className={styles.cycleToggle}>
          <button
            className={`${styles.cycleBtn} ${cycle === 'monthly' ? styles.cycleBtnActive : ''}`}
            onClick={() => setCycle('monthly')}
          >
            Mjesečno
          </button>
          <button
            className={`${styles.cycleBtn} ${cycle === 'annual' ? styles.cycleBtnActive : ''}`}
            onClick={() => setCycle('annual')}
          >
            Godišnje
            <span className={styles.saveBadge}>Uštedi {ANNUAL_DISCOUNT}%</span>
          </button>
        </div>
        {cycle === 'annual' && (
          <div className={styles.annualNote}>
            Godišnji plan se naplaćuje jednokratno. Dobijate 2,4 mjeseca besplatno.
          </div>
        )}
      </div>

      {/* Plan kartice */}
      <div className={styles.plansGrid}>
        {PLANS.map(plan => {
          const p = price(plan.id)
          const isCurrent = currentPlan === plan.id
          const isDowngrade = PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(currentPlan)

          return (
            <div
              key={plan.id}
              className={`${styles.planCard} ${isCurrent ? styles.planCurrent : ''} ${plan.popular ? styles.planPopular : ''}`}
              style={isCurrent ? { borderColor: plan.color } : {}}
            >
              {plan.popular && !isCurrent && (
                <div className={styles.popularBadge} style={{ background: plan.color }}>
                  Najpopularnije
                </div>
              )}
              {isCurrent && (
                <div className={styles.popularBadge} style={{ background: plan.color }}>
                  ✓ Tvoj plan
                </div>
              )}

              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: plan.color }}>{plan.name}</div>
                <div className={styles.planDesc}>{plan.desc}</div>
              </div>

              <div className={styles.planPricing}>
                {plan.id === 'starter' ? (
                  <>
                    <span className={styles.planPrice}>Besplatno</span>
                    <span className={styles.planPeriod}>zauvijek</span>
                  </>
                ) : p ? (
                  <>
                    <span className={styles.planPrice}>€{p.main}</span>
                    <span className={styles.planPeriod}>/mj</span>
                    {p.save && (
                      <div className={styles.annualTotal}>naplaćuje se {p.sub}</div>
                    )}
                  </>
                ) : null}
              </div>

              <ul className={styles.featureList}>
                {plan.features.map(f => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.featureCheck} style={{ color: plan.color }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className={styles.planCta}>
                {isCurrent ? (
                  <div className={styles.currentLabel} style={{ color: plan.color }}>
                    Trenutni plan
                  </div>
                ) : plan.id === 'starter' ? (
                  isDowngrade ? (
                    <button className={styles.downgradeBtn} onClick={() => alert('Za downgrade kontaktirajte podršku na support@smartmeni.me')}>
                      Smanji plan
                    </button>
                  ) : null
                ) : plan.paypal ? (
                  <button
                    className={styles.upgradeBtn}
                    style={{ background: plan.color }}
                    onClick={handlePayPal}
                    disabled={loading}
                  >
                    {loading ? 'Preusmjeravanje...' : '🅿 Plati putem PayPal-a'}
                  </button>
                ) : plan.comingSoon ? (
                  <div className={styles.comingSoonWrap}>
                    <div className={styles.comingSoonBadge}>Stripe — uskoro</div>
                    <a
                      href={`mailto:support@smartmeni.me?subject=Interes za ${plan.name} plan`}
                      className={styles.contactBtn}
                    >
                      ✉️ Kontaktirajte nas
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {error && <div className={styles.alertDanger} style={{ marginTop: 16 }}>{error}</div>}

      {/* Enterprise */}
      <div className={styles.enterpriseCard}>
        <div className={styles.enterpriseLeft}>
          <div className={styles.enterpriseName}>Enterprise</div>
          <div className={styles.enterpriseDesc}>
            Više objekata, channel manager (Beds24), portfolio dashboard, brand šabloni.
            Za hotelske lance i portfelje od 3+ objekata.
          </div>
        </div>
        <a
          href="mailto:support@smartmeni.me?subject=Enterprise upit"
          className={styles.enterpriseBtn}
        >
          Kontaktirajte nas →
        </a>
      </div>

      {/* FAQ */}
      <div className={styles.faq}>
        <div className={styles.faqTitle}>Često postavljana pitanja</div>
        {[
          { q: 'Mogu li promijeniti plan u bilo kom trenutku?', a: 'Da, upgrade je trenutno aktivan. Za downgrade kontaktirajte podršku.' },
          { q: 'Šta se dešava s podacima ako promijenim plan?', a: 'Podaci se nikad ne brišu. Ako upgradujete, odmah dobijate pristup novim modulima.' },
          { q: 'Kakva je razlika između mjesečnog i godišnjeg plana?', a: `Godišnji plan košta ${ANNUAL_DISCOUNT}% manje — kao da dobijate 2,4 mjeseca besplatno. Naplaćuje se jednokratno na godinu dana.` },
          { q: 'Mogu li otkazati pretplatu?', a: 'Da, u bilo kom trenutku. Plan ostaje aktivan do kraja plaćenog perioda.' },
        ].map(({ q, a }) => (
          <div key={q} className={styles.faqItem}>
            <div className={styles.faqQ}>{q}</div>
            <div className={styles.faqA}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
