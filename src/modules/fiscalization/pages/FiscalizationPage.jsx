import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { formatMoney, fromMinorUnits } from '../../../lib/currencies'
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

const SRC_KEY = { order: 'fiskSrcOrder', folio: 'fiskSrcFolio', spa: 'fiskSrcSpa', booking: 'fiskSrcBooking' }
const STATUS_KEY = { PENDING: 'fiskStatPending', QUEUED: 'fiskStatQueued', FISCALIZED: 'fiskStatFiscalized', FAILED: 'fiskStatFailed' }

export default function FiscalizationPage() {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant } = usePlatform()
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuStats, setMenuStats] = useState(null) // { total, classified }
  const [invoices, setInvoices] = useState([])
  const invMoney = (cents, cur) => formatMoney(fromMinorUnits(cents, cur), cur, i18n.language)

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

  // Pregled klasifikacije: koliko KATEGORIJA ima dodijeljenu PDV stopu (jela
  // nasljeđuju iz kategorije; per-jelo je override).
  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    Promise.all([
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id).not('vat_rate_key', 'is', null),
    ]).then(([all, cls]) => {
      if (cancelled) return
      setMenuStats({ total: all.count || 0, classified: cls.count || 0 })
    })
    return () => { cancelled = true }
  }, [restaurant?.id])

  // Izdati računi (najnoviji).
  useEffect(() => {
    if (!restaurant?.id) return
    let cancelled = false
    supabase.from('invoices')
      .select('id, invoice_number, issued_at, source_type, total_cents, total_vat_cents, currency, fiscal_status')
      .eq('restaurant_id', restaurant.id)
      .order('issued_at', { ascending: false })
      .limit(25)
      .then(({ data }) => { if (!cancelled) setInvoices(data || []) })
    return () => { cancelled = true }
  }, [restaurant?.id])

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
        <div className={styles.cardTitle}>{t('fiskClassifyTitle')}</div>
        <div className={styles.cardHint}>{t('fiskClassifyHint')}</div>
        {menuStats && menuStats.total > 0 && (
          <div className={styles.classifyRow}>
            <span className={menuStats.classified >= menuStats.total ? styles.statOk : styles.statWarn}>
              {menuStats.classified} / {menuStats.total}
            </span>
            <span className={styles.classifyLabel}>{t('fiskClassifyMenu')}</span>
            <Link to="/admin/menu" className={styles.link}>{t('fiskClassifyLink')}</Link>
          </div>
        )}
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('fiskInvoicesTitle')}</div>
        <div className={styles.cardHint}>{t('fiskInvoicesHint')}</div>
        {invoices.length === 0 ? (
          <div className={styles.muted}>{t('fiskInvEmpty')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('fiskColNumber')}</th>
                <th>{t('fiskColDate')}</th>
                <th>{t('fiskColSource')}</th>
                <th className={styles.right}>{t('fiskColVat')}</th>
                <th className={styles.right}>{t('fiskColTotal')}</th>
                <th>{t('fiskColStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td><code className={styles.code}>{inv.invoice_number}</code></td>
                  <td>{new Date(inv.issued_at).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td>{t(SRC_KEY[inv.source_type] || 'fiskSrcOrder')}</td>
                  <td className={styles.right}>{invMoney(inv.total_vat_cents, inv.currency)}</td>
                  <td className={styles.right}>{invMoney(inv.total_cents, inv.currency)}</td>
                  <td><span className={styles.statBadge}>{t(STATUS_KEY[inv.fiscal_status] || 'fiskStatPending')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
