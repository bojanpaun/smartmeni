import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import styles from './FiscalizationPage.module.css'

// FISK addon — „dom" fiskalizacije. Zasad prikazuje stanje (poslovni identitet,
// PDV stope iz tax_config) + placeholdere za faze koje slijede (klasifikacija,
// računi, provajder/poreska uprava). Univerzalno jezgro je dostupno svima; ovaj
// ekran je iza <AddonGuard addonId="fiscalization">.
function IdBadge({ ok, label, value, fallback }) {
  return (
    <div className={styles.idBadge}>
      <span className={ok ? styles.dotOk : styles.dotMiss}>{ok ? '✓' : '○'}</span>
      <div>
        <div className={styles.idLabel}>{label}</div>
        <div className={styles.idValue}>{value || fallback}</div>
      </div>
    </div>
  )
}

export default function FiscalizationPage() {
  const { t } = useTranslation('admin')
  const { restaurant } = usePlatform()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('tax_config').select('rates').eq('country', 'ME').maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setRates(Array.isArray(data?.rates) ? data.rates : [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const idOk = !!restaurant?.tax_id
  const vatOk = !!restaurant?.vat_number
  const ibanOk = !!restaurant?.iban
  const idComplete = idOk && vatOk

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>🧾 {t('fiskTitle')}</h1>
        <p className={styles.subtitle}>{t('fiskSubtitle')}</p>
      </div>

      {/* Poslovni identitet prodavca */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('fiskBusinessTitle')}</div>
        <div className={styles.idRow}>
          <IdBadge ok={idOk}   label={t('gsTaxId')}     value={restaurant?.tax_id}     fallback={t('fiskNotSet')} />
          <IdBadge ok={vatOk}  label={t('gsVatNumber')} value={restaurant?.vat_number} fallback={t('fiskNotSet')} />
          <IdBadge ok={ibanOk} label={t('gsIban')}      value={restaurant?.iban}       fallback={t('fiskNotSet')} />
        </div>
        {!idComplete && (
          <div className={styles.warn}>
            ⚠️ {t('fiskBusinessMissing')}{' '}
            <Link to="/admin/settings/general" className={styles.link}>{t('fiskBusinessLink')}</Link>
          </div>
        )}
      </div>

      {/* PDV stope (tax_config) */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('fiskRatesTitle')}</div>
        <div className={styles.cardHint}>{t('fiskRatesHint')}</div>
        {loading ? (
          <div className={styles.muted}>{t('loading')}</div>
        ) : rates.length === 0 ? (
          <div className={styles.muted}>{t('fiskRatesEmpty')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('fiskRateKey')}</th>
                <th>{t('fiskRateLabel')}</th>
                <th className={styles.right}>{t('fiskRateValue')}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(r => (
                <tr key={r.key}>
                  <td><code className={styles.code}>{r.key}</code></td>
                  <td>{r.label}</td>
                  <td className={styles.right}>{(Number(r.value) * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Placeholderi — naredne faze */}
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{t('fiskClassifyTitle')}</span>
          <span className={styles.soon}>{t('fiskSoon')}</span>
        </div>
        <div className={styles.cardHint}>{t('fiskClassifyHint')}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{t('fiskInvoicesTitle')}</span>
          <span className={styles.soon}>{t('fiskSoon')}</span>
        </div>
        <div className={styles.cardHint}>{t('fiskInvoicesHint')}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <span className={styles.cardTitle}>{t('fiskProviderTitle')}</span>
          <span className={styles.soon}>{t('fiskSoon')}</span>
        </div>
        <div className={styles.cardHint}>{t('fiskProviderHint')}</div>
      </div>
    </div>
  )
}
