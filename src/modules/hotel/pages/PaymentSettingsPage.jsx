import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useDemoGuard } from '../../../lib/useDemoGuard'
import { logAudit } from '../../../lib/auditLog'
import styles from './PaymentSettings.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// Polja kredencijala po provajderu (labelKey/hintKey → t())
const CREDENTIAL_FIELDS = {
  stripe: [
    { key: 'secret_key',      labelKey: 'psSecretKey',      placeholder: 'sk_test_...',   hintKey: 'psSecretKeyHint' },
    { key: 'webhook_secret',  labelKey: 'psWebhookSecret',  placeholder: 'whsec_...',     hintKey: 'psWebhookSecretHint' },
  ],
  monri: [
    { key: 'merchant_key',       labelKey: 'psMonriKey',  placeholder: '',  hintKey: 'psMonriKeyHint' },
    { key: 'authenticity_token', labelKey: 'psAuthToken', placeholder: '',  hintKey: 'psAuthTokenHint' },
  ],
}

const PROVIDER_LABELS = { stripe: 'Stripe', monri: 'Monri' }
const PROVIDER_ICONS  = { stripe: '💳', monri: '🏦' }

const EMPTY_FORM = { provider: 'stripe', mode: 'test' }
const EMPTY_CREDS = {}

export default function PaymentSettingsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const demoGuard = useDemoGuard()

  const [configs, setConfigs]         = useState([])
  const [credStatus, setCredStatus]   = useState({})  // config_id → boolean
  const [loading, setLoading]         = useState(true)

  // Config modal
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [editConfig, setEditConfig]           = useState(null)  // null = novi
  const [configForm, setConfigForm]           = useState(EMPTY_FORM)
  const [configSaving, setConfigSaving]       = useState(false)
  const [configError, setConfigError]         = useState('')

  // Credentials modal
  const [showCredsModal, setShowCredsModal] = useState(false)
  const [credsForConfig, setCredsForConfig] = useState(null)
  const [credsForm, setCredsForm]           = useState(EMPTY_CREDS)
  const [credsSaving, setCredsSaving]       = useState(false)
  const [credsError, setCredsError]         = useState('')
  const [credsSaved, setCredsSaved]         = useState(false)

  useEffect(() => { if (restaurant) load() }, [restaurant])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tenant_payment_configs')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at')

    setConfigs(data || [])

    // Provjeri jesu li kredencijali postavljeni za svaki config
    if (data?.length) {
      const checks = await Promise.all(
        data.map(c =>
          supabase.rpc('check_payment_credentials', { p_config_id: c.id })
            .then(({ data: hasIt }) => [c.id, !!hasIt])
        )
      )
      setCredStatus(Object.fromEntries(checks))
    }
    setLoading(false)
  }

  // ── Config CRUD ─────────────────────────────────────────────────

  const openNewConfig = () => {
    setEditConfig(null)
    setConfigForm(EMPTY_FORM)
    setConfigError('')
    setShowConfigModal(true)
  }

  const openEditConfig = (cfg) => {
    setEditConfig(cfg)
    setConfigForm({ provider: cfg.provider, mode: cfg.mode })
    setConfigError('')
    setShowConfigModal(true)
  }

  const saveConfig = async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    setConfigError('')

    if (editConfig) {
      const { error } = await supabase
        .from('tenant_payment_configs')
        .update({ provider: configForm.provider, mode: configForm.mode, updated_at: new Date().toISOString() })
        .eq('id', editConfig.id)
      if (error) { setConfigError(error.message); setConfigSaving(false); return }
      setConfigs(prev => prev.map(c => c.id === editConfig.id ? { ...c, ...configForm } : c))
    } else {
      const { data, error } = await supabase
        .from('tenant_payment_configs')
        .insert({ restaurant_id: restaurant.id, provider: configForm.provider, mode: configForm.mode })
        .select().single()
      if (error) { setConfigError(error.message); setConfigSaving(false); return }
      setConfigs(prev => [...prev, data])
    }

    setConfigSaving(false)
    logAudit({
      restaurantId: restaurant.id,
      action: editConfig ? 'payment_config.update' : 'payment_config.create',
      entityType: 'payment_config', entityId: editConfig?.id ?? null,
      summary: `Payment provajder ${editConfig ? 'izmijenjen' : 'dodat'}: ${configForm.provider} (${configForm.mode})`,
    })
    setShowConfigModal(false)
  }

  const deleteConfig = async (id) => {
    if (!confirm(t('psDeleteConfirm'))) return
    await supabase.from('tenant_payment_configs').delete().eq('id', id)
    setConfigs(prev => prev.filter(c => c.id !== id))
    setCredStatus(prev => { const n = { ...prev }; delete n[id]; return n })
    logAudit({
      restaurantId: restaurant.id, action: 'payment_config.delete',
      entityType: 'payment_config', entityId: id, summary: 'Payment provajder obrisan',
    })
  }

  const toggleActive = async (cfg) => {
    const newVal = !cfg.is_active
    await supabase.from('tenant_payment_configs').update({ is_active: newVal }).eq('id', cfg.id)
    setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, is_active: newVal } : c))
    logAudit({
      restaurantId: restaurant.id,
      action: newVal ? 'payment_config.activate' : 'payment_config.deactivate',
      entityType: 'payment_config', entityId: cfg.id,
      summary: `Payment provajder ${newVal ? 'aktiviran' : 'deaktiviran'}: ${cfg.provider}`,
    })
  }

  const setDefault = async (cfg) => {
    // Trigger na DB strani osigurava da je samo jedan default
    await supabase.from('tenant_payment_configs').update({ is_default: true }).eq('id', cfg.id)
    setConfigs(prev => prev.map(c => ({ ...c, is_default: c.id === cfg.id })))
  }

  // ── Credentials ──────────────────────────────────────────────────

  const openCreds = (cfg) => {
    setCredsForConfig(cfg)
    setCredsForm(EMPTY_CREDS)
    setCredsError('')
    setCredsSaved(false)
    setShowCredsModal(true)
  }

  const saveCreds = async (e) => {
    e.preventDefault()
    if (demoGuard()) return   // demo: ne čuvaj prave payment ključeve
    const fields = CREDENTIAL_FIELDS[credsForConfig.provider] || []
    const missing = fields.filter(f => !credsForm[f.key]?.trim())
    if (missing.length) {
      setCredsError(t('psRequiredFields', { fields: missing.map(f => t(f.labelKey)).join(', ') }))
      return
    }

    setCredsSaving(true)
    setCredsError('')

    const { error } = await supabase.rpc('save_payment_credentials', {
      p_config_id:   credsForConfig.id,
      p_credentials: credsForm,
    })

    setCredsSaving(false)
    if (error) { setCredsError(error.message); return }

    setCredStatus(prev => ({ ...prev, [credsForConfig.id]: true }))
    logAudit({
      restaurantId: restaurant.id, action: 'payment_credentials.save',
      entityType: 'payment_config', entityId: credsForConfig.id,
      summary: `Sačuvani ključevi za ${credsForConfig.provider}`,
    })
    setCredsSaved(true)
    setTimeout(() => setShowCredsModal(false), 1200)
  }

  if (loading) return <div className={gsStyles.page}><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('loading')}</div></div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 800 }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={gsStyles.title}>{t('psTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('psSubtitle')}</p>
        </div>
        <button className={styles.btnAdd} onClick={openNewConfig}>+ {t('psAddProvider')}</button>
      </div>

      {/* Info banner */}
      <div className={styles.infoBanner}>
        <div className={styles.infoBannerIcon}>ℹ</div>
        <div>
          <strong>{t('psHowItWorks')}:</strong> {t('psHowItWorksBody')}
        </div>
      </div>

      {configs.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💳</div>
          <div className={styles.emptyTitle}>{t('psNoProviders')}</div>
          <div className={styles.emptyDesc}>{t('psNoProvidersDesc')}</div>
          <button className={styles.btnAdd} onClick={openNewConfig}>+ {t('psAddProvider')}</button>
        </div>
      )}

      <div className={styles.configList}>
        {configs.map(cfg => {
          const hasCreds = credStatus[cfg.id]
          const fields   = CREDENTIAL_FIELDS[cfg.provider] || []
          return (
            <div key={cfg.id} className={`${styles.configCard} ${cfg.is_active ? styles.configCardActive : ''}`}>
              <div className={styles.configCardTop}>
                <div className={styles.configProvider}>
                  <span className={styles.providerIcon}>{PROVIDER_ICONS[cfg.provider]}</span>
                  <span className={styles.providerName}>{PROVIDER_LABELS[cfg.provider]}</span>
                  <span className={`${styles.modeBadge} ${cfg.mode === 'live' ? styles.modeLive : styles.modeTest}`}>
                    {cfg.mode === 'live' ? 'Live' : 'Test'}
                  </span>
                  {cfg.is_default && <span className={styles.defaultBadge}>★ {t('psDefault')}</span>}
                </div>
                <div className={styles.configStatus}>
                  <span className={cfg.is_active ? styles.statusActive : styles.statusInactive}>
                    {cfg.is_active ? `● ${t('htActive')}` : `○ ${t('psInactive')}`}
                  </span>
                </div>
              </div>

              <div className={styles.configCredRow}>
                {hasCreds
                  ? <span className={styles.credsSet}>✓ {t('psCredsSet')}</span>
                  : <span className={styles.credsMissing}>⚠ {t('psCredsMissing')}</span>
                }
              </div>

              <div className={styles.configActions}>
                <button className={styles.btnSecondary} onClick={() => openCreds(cfg)}>
                  {hasCreds ? `🔑 ${t('psChangeCreds')}` : `🔑 ${t('psSetCreds')}`}
                </button>
                {!cfg.is_default && cfg.is_active && (
                  <button className={styles.btnSecondary} onClick={() => setDefault(cfg)}>★ {t('psSetDefault')}</button>
                )}
                <button
                  className={cfg.is_active ? styles.btnWarn : styles.btnOk}
                  onClick={() => toggleActive(cfg)}
                >
                  {cfg.is_active ? t('psDeactivate') : t('psActivate')}
                </button>
                <button className={styles.btnSecondary} onClick={() => openEditConfig(cfg)}>{t('htEdit')}</button>
                <button className={styles.btnDanger} onClick={() => deleteConfig(cfg.id)}>{t('htDelete')}</button>
              </div>

              {!hasCreds && (
                <div className={styles.setupSteps}>
                  <div className={styles.setupTitle}>{t('psHowToSetup', { provider: PROVIDER_LABELS[cfg.provider] })}</div>
                  {fields.map(f => (
                    <div key={f.key} className={styles.setupStep}>
                      <span className={styles.setupField}>{t(f.labelKey)}</span>
                      <span className={styles.setupHint}>{t(f.hintKey)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Config modal */}
      {showConfigModal && (
        <div className={styles.overlay} onClick={() => setShowConfigModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editConfig ? t('psEditProvider') : t('psNewProvider')}</div>
              <button className={styles.modalClose} onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <form onSubmit={saveConfig}>
              <div className={styles.field}>
                <label>{t('psProvider')}</label>
                <select value={configForm.provider} onChange={e => setConfigForm(f => ({ ...f, provider: e.target.value }))}>
                  <option value="stripe">{t('psStripeOpt')}</option>
                  <option value="monri">{t('psMonriOpt')}</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>{t('psMode')}</label>
                <div className={styles.modeToggle}>
                  <button type="button"
                    className={`${styles.modeBtn} ${configForm.mode === 'test' ? styles.modeBtnActive : ''}`}
                    onClick={() => setConfigForm(f => ({ ...f, mode: 'test' }))}>
                    {t('psTestMode')}
                  </button>
                  <button type="button"
                    className={`${styles.modeBtn} ${configForm.mode === 'live' ? styles.modeBtnActive : ''}`}
                    onClick={() => setConfigForm(f => ({ ...f, mode: 'live' }))}>
                    {t('psLiveMode')}
                  </button>
                </div>
                {configForm.mode === 'live' && (
                  <div className={styles.liveWarning}>{t('psLiveWarning')}</div>
                )}
              </div>
              {configError && <div className={styles.error}>{configError}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowConfigModal(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnPrimary} disabled={configSaving}>
                  {configSaving ? t('saving') : (editConfig ? t('htSaveChanges') : t('psAddProvider'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {showCredsModal && credsForConfig && (
        <div className={styles.overlay} onClick={() => setShowCredsModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                🔑 {t('psCredentials')} — {PROVIDER_LABELS[credsForConfig.provider]} ({credsForConfig.mode})
              </div>
              <button className={styles.modalClose} onClick={() => setShowCredsModal(false)}>✕</button>
            </div>
            <div className={styles.credsSecurity}>
              {t('psCredsSecurity')}
            </div>

            {/* Pomoć tenantu — odakle ključevi + callback URL za dashboard */}
            <div style={{ background: 'var(--c-info-bg)', border: '1px solid var(--c-info-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: 'var(--c-text)' }}>
              <strong>📘 {t('psHowToFill')}</strong>
              {credsForConfig.provider === 'monri' ? (
                <ol style={{ margin: '6px 0 10px 18px', padding: 0, lineHeight: 1.6 }}>
                  <li>{t('psMonriStep1')}</li>
                  <li>{t('psMonriStep2')}</li>
                  <li>{t('psMonriStep3')}</li>
                </ol>
              ) : (
                <ol style={{ margin: '6px 0 10px 18px', padding: 0, lineHeight: 1.6 }}>
                  <li>{t('psStripeStep1')}</li>
                  <li>{t('psStripeStep2')}</li>
                </ol>
              )}
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('psCallbackUrl', { provider: PROVIDER_LABELS[credsForConfig.provider] })}</div>
              <code style={{ display: 'block', background: 'var(--c-bg-subtle)', padding: '6px 8px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all', color: 'var(--c-text)' }}>
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-webhook?provider={credsForConfig.provider}
              </code>
              <div style={{ color: 'var(--c-text-muted)', marginTop: 6 }}>
                {credsForConfig.provider === 'monri' ? t('psCallbackNoteMonri') : t('psCallbackNoteStripe')}
              </div>
            </div>
            {credsSaved ? (
              <div className={styles.credsSavedMsg}>{t('psCredsSavedMsg')}</div>
            ) : (
              <form onSubmit={saveCreds}>
                {(CREDENTIAL_FIELDS[credsForConfig.provider] || []).map(field => (
                  <div key={field.key} className={styles.field}>
                    <label>{t(field.labelKey)} *</label>
                    <input
                      type="password"
                      value={credsForm[field.key] || ''}
                      onChange={e => setCredsForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      autoComplete="off"
                    />
                    <div className={styles.fieldHint}>{t(field.hintKey)}</div>
                  </div>
                ))}
                {credsError && <div className={styles.error}>{credsError}</div>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowCredsModal(false)}>{t('cancel')}</button>
                  <button type="submit" className={styles.btnPrimary} disabled={credsSaving}>
                    {credsSaving ? t('saving') : t('psSaveCreds')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
