import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('admin')
  const { restaurant, subscription, setSubscription, plans: dbPlans, betaMode } = usePlatform()
  const [cycle, setCycle] = useState('annual') // 'monthly' | 'annual'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const status = planStatus(restaurant)
  const days   = trialDaysLeft(restaurant)
  const currentPlan = (() => {
    const p = restaurant?.plan || 'starter'
    return p === 'pro' ? 'restaurant' : p
  })()

  // Cijene: izvor istine je DB tabela `plans` (superadmin ih uređuje); padamo na
  // hardkodirani PLAN_PRICING ako DB još nije učitan ili nema taj plan.
  const price = (planId) => {
    if (planId === 'starter') return null
    const db = dbPlans?.find((p) => p.id === planId)
    const p = db
      ? { monthly: db.price_monthly, annual_per_month: db.price_annual_per_month, annual_total: db.price_annual_total }
      : PLAN_PRICING[planId]
    if (!p || p.monthly == null) return null
    return cycle === 'annual'
      ? { main: p.annual_per_month, sub: `€${p.annual_total}/god`, save: true }
      : { main: p.monthly, sub: '/mj', save: false }
  }

  // Plan kartice iz DB (opis/funkcije/boja/oznake); fallback na hardkodirani PLANS
  // ako DB nije učitan. paypal=true → PayPal dugme (zasad samo restaurant i planovi
  // sa paypal_plan_id; ostalo "uskoro"/kontakt). Vidi Faza E za punu kupovinu.
  const planList = (dbPlans && dbPlans.length)
    ? dbPlans.filter(p => p.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(p => ({
          id: p.id, name: p.name, color: p.color || 'var(--c-brand, #0d7a52)',
          desc: p.description || '', features: p.features || [],
          popular: p.is_popular, comingSoon: p.coming_soon,
          paypal: !p.coming_soon && p.id !== 'starter' && (p.id === 'restaurant' || !!p.paypal_plan_id),
        }))
    : PLANS
  const planOrder = planList.map(p => p.id)

  const handlePayPal = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t('bpNotLoggedIn'))
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
      else throw new Error(data.error ?? t('bpSubError'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Beta period ──────────────────────────────────────────────
  // Dok je beta uključena, sve je besplatno → ne prikazuj planove/kupovinu.
  if (betaMode) return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('bpTitle')}</h1>
      </div>
      <div className={styles.complimentaryCard}>
        <div className={styles.complimentaryIcon}>🧪</div>
        <div className={styles.complimentaryTitle}>{t('bpBetaTitle')}</div>
        <div className={styles.complimentaryDesc}>
          {t('bpBetaDesc')}
        </div>
      </div>
    </div>
  )

  // ── Complimentary ────────────────────────────────────────────
  if (status === 'complimentary') return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('bpTitle')}</h1>
      </div>
      <div className={styles.complimentaryCard}>
        <div className={styles.complimentaryIcon}>🎁</div>
        <div className={styles.complimentaryTitle}>{t('bpComplimentaryTitle')}</div>
        <div className={styles.complimentaryDesc}>
          {t('bpComplimentaryDesc')}
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
        <h1 className={styles.title}>{t('bpTitle')}</h1>
        <p className={styles.subtitle}>{t('bpSubtitle')}</p>
      </div>

      {/* Status alertovi */}
      {status === 'suspended' && (
        <div className={styles.alertDanger}>
          ⚠️ {t('bpSuspended')}
        </div>
      )}
      {status === 'trial' && days > 0 && (
        <div className={styles.alertTrial}>
          🎁 {t('bpTrialPre')}<strong>{days} {t('bpDays')}</strong>{t('bpTrialPost')}
        </div>
      )}
      {status === 'expired' && (
        <div className={styles.alertExpired}>
          ⏰ {t('bpExpired')}
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className={styles.cycleToggleWrap}>
        <div className={styles.cycleToggle}>
          <button
            className={`${styles.cycleBtn} ${cycle === 'monthly' ? styles.cycleBtnActive : ''}`}
            onClick={() => setCycle('monthly')}
          >
            {t('bpMonthly')}
          </button>
          <button
            className={`${styles.cycleBtn} ${cycle === 'annual' ? styles.cycleBtnActive : ''}`}
            onClick={() => setCycle('annual')}
          >
            {t('bpAnnual')}
            <span className={styles.saveBadge}>{t('bpSavePercent', { percent: ANNUAL_DISCOUNT })}</span>
          </button>
        </div>
        {cycle === 'annual' && (
          <div className={styles.annualNote}>
            {t('bpAnnualNote')}
          </div>
        )}
      </div>

      {/* Plan kartice */}
      <div className={styles.plansGrid}>
        {planList.map(plan => {
          const p = price(plan.id)
          const isCurrent = currentPlan === plan.id
          const isDowngrade = planOrder.indexOf(plan.id) < planOrder.indexOf(currentPlan)

          return (
            <div
              key={plan.id}
              className={`${styles.planCard} ${isCurrent ? styles.planCurrent : ''} ${plan.popular ? styles.planPopular : ''}`}
              style={isCurrent ? { borderColor: plan.color } : {}}
            >
              {plan.popular && !isCurrent && (
                <div className={styles.popularBadge} style={{ background: plan.color }}>
                  {t('bpMostPopular')}
                </div>
              )}
              {isCurrent && (
                <div className={styles.popularBadge} style={{ background: plan.color }}>
                  ✓ {t('bpYourPlan')}
                </div>
              )}

              <div className={styles.planHeader}>
                <div className={styles.planName} style={{ color: plan.color }}>{plan.name}</div>
                <div className={styles.planDesc}>{plan.desc}</div>
              </div>

              <div className={styles.planPricing}>
                {plan.id === 'starter' ? (
                  <>
                    <span className={styles.planPrice}>{t('bpFree')}</span>
                    <span className={styles.planPeriod}>{t('bpForever')}</span>
                  </>
                ) : p ? (
                  <>
                    <span className={styles.planPrice}>€{p.main}</span>
                    <span className={styles.planPeriod}>{t('bpPerMonth')}</span>
                    {p.save && (
                      <div className={styles.annualTotal}>{t('bpBilledAs', { sub: p.sub })}</div>
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
                    {t('bpCurrentPlan')}
                  </div>
                ) : plan.id === 'starter' ? (
                  isDowngrade ? (
                    <button className={styles.downgradeBtn} onClick={() => alert(t('bpDowngradeContact'))}>
                      {t('bpDowngrade')}
                    </button>
                  ) : null
                ) : plan.paypal ? (
                  <button
                    className={styles.upgradeBtn}
                    style={{ background: plan.color }}
                    onClick={handlePayPal}
                    disabled={loading}
                  >
                    {loading ? t('bpRedirecting') : `🅿 ${t('bpPayPayPal')}`}
                  </button>
                ) : plan.comingSoon ? (
                  <div className={styles.comingSoonWrap}>
                    <div className={styles.comingSoonBadge}>{t('bpStripeSoon')}</div>
                    <a
                      href={`mailto:support@restby.me?subject=${encodeURIComponent(t('bpInterestSubject', { plan: plan.name }))}`}
                      className={styles.contactBtn}
                    >
                      ✉️ {t('bpContactUs')}
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
            {t('bpEnterpriseDesc')}
          </div>
        </div>
        <a
          href={`mailto:support@restby.me?subject=${encodeURIComponent(t('bpEnterpriseSubject'))}`}
          className={styles.enterpriseBtn}
        >
          {t('bpContactUs')} →
        </a>
      </div>

      {/* FAQ */}
      <div className={styles.faq}>
        <div className={styles.faqTitle}>{t('bpFaqTitle')}</div>
        {[
          { q: t('bpFaq1Q'), a: t('bpFaq1A') },
          { q: t('bpFaq2Q'), a: t('bpFaq2A') },
          { q: t('bpFaq3Q'), a: t('bpFaq3A', { percent: ANNUAL_DISCOUNT }) },
          { q: t('bpFaq4Q'), a: t('bpFaq4A') },
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
