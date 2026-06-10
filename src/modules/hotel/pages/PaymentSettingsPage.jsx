import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './PaymentSettings.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// Polja kredencijala po provajderu
const CREDENTIAL_FIELDS = {
  stripe: [
    { key: 'secret_key',      label: 'Secret Key',      placeholder: 'sk_test_...',   hint: 'Stripe Dashboard → API Keys' },
    { key: 'webhook_secret',  label: 'Webhook Secret',  placeholder: 'whsec_...',     hint: 'Stripe Dashboard → Webhooks → Signing secret' },
  ],
  monri: [
    { key: 'merchant_key',       label: 'Key (tajni ključ)',  placeholder: '',  hint: 'Monri/Payten Dashboard → API podešavanja → "Key". Služi za digitalni potpis (digest). Tajno — ne dijeliti.' },
    { key: 'authenticity_token', label: 'Authenticity Token', placeholder: '',  hint: 'Monri Dashboard → API podešavanja → "Authenticity token" (identifikator trgovca).' },
  ],
}

const PROVIDER_LABELS = { stripe: 'Stripe', monri: 'Monri' }
const PROVIDER_ICONS  = { stripe: '💳', monri: '🏦' }

const EMPTY_FORM = { provider: 'stripe', mode: 'test' }
const EMPTY_CREDS = {}

export default function PaymentSettingsPage() {
  const { restaurant } = usePlatform()

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
    setShowConfigModal(false)
  }

  const deleteConfig = async (id) => {
    if (!confirm('Obrisati konfiguraciju provajdera? Svi kredencijali će biti izbrisani.')) return
    await supabase.from('tenant_payment_configs').delete().eq('id', id)
    setConfigs(prev => prev.filter(c => c.id !== id))
    setCredStatus(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const toggleActive = async (cfg) => {
    const newVal = !cfg.is_active
    await supabase.from('tenant_payment_configs').update({ is_active: newVal }).eq('id', cfg.id)
    setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, is_active: newVal } : c))
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
    const fields = CREDENTIAL_FIELDS[credsForConfig.provider] || []
    const missing = fields.filter(f => !credsForm[f.key]?.trim())
    if (missing.length) {
      setCredsError(`Obavezna polja: ${missing.map(f => f.label).join(', ')}`)
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
    setCredsSaved(true)
    setTimeout(() => setShowCredsModal(false), 1200)
  }

  if (loading) return <div className={gsStyles.page}><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--c-text-muted)' }}>Učitavanje...</div></div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 800 }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={gsStyles.title}>Plaćanja</h1>
          <p className={gsStyles.subtitle}>Konfiguracija payment provajdera za online naplatu gostiju (booking, folio).</p>
        </div>
        <button className={styles.btnAdd} onClick={openNewConfig}>+ Dodaj provajder</button>
      </div>

      {/* Info banner */}
      <div className={styles.infoBanner}>
        <div className={styles.infoBannerIcon}>ℹ</div>
        <div>
          <strong>Kako radi:</strong> Svaki provajder koji aktiviraš i postaviš kao <em>default</em> koristiće se za online naplate gostiju.
          Postavi <strong>Test</strong> mod za probno testiranje, <strong>Live</strong> za pravo plaćanje.
          Kredencijali se čuvaju šifrovano i nisu vidljivi ni adminu.
        </div>
      </div>

      {configs.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>💳</div>
          <div className={styles.emptyTitle}>Nema konfiguriranih provajdera</div>
          <div className={styles.emptyDesc}>Dodaj Stripe ili Monri da omogućiš online plaćanje.</div>
          <button className={styles.btnAdd} onClick={openNewConfig}>+ Dodaj provajder</button>
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
                  {cfg.is_default && <span className={styles.defaultBadge}>★ Default</span>}
                </div>
                <div className={styles.configStatus}>
                  <span className={cfg.is_active ? styles.statusActive : styles.statusInactive}>
                    {cfg.is_active ? '● Aktivan' : '○ Neaktivan'}
                  </span>
                </div>
              </div>

              <div className={styles.configCredRow}>
                {hasCreds
                  ? <span className={styles.credsSet}>✓ Kredencijali postavljeni</span>
                  : <span className={styles.credsMissing}>⚠ Kredencijali nisu postavljeni — provajder ne može procesirati plaćanja</span>
                }
              </div>

              <div className={styles.configActions}>
                <button className={styles.btnSecondary} onClick={() => openCreds(cfg)}>
                  {hasCreds ? '🔑 Promijeni kredencijale' : '🔑 Postavi kredencijale'}
                </button>
                {!cfg.is_default && cfg.is_active && (
                  <button className={styles.btnSecondary} onClick={() => setDefault(cfg)}>★ Postavi kao default</button>
                )}
                <button
                  className={cfg.is_active ? styles.btnWarn : styles.btnOk}
                  onClick={() => toggleActive(cfg)}
                >
                  {cfg.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                </button>
                <button className={styles.btnSecondary} onClick={() => openEditConfig(cfg)}>Uredi</button>
                <button className={styles.btnDanger} onClick={() => deleteConfig(cfg.id)}>Obriši</button>
              </div>

              {!hasCreds && (
                <div className={styles.setupSteps}>
                  <div className={styles.setupTitle}>Kako postaviti {PROVIDER_LABELS[cfg.provider]}:</div>
                  {fields.map(f => (
                    <div key={f.key} className={styles.setupStep}>
                      <span className={styles.setupField}>{f.label}</span>
                      <span className={styles.setupHint}>{f.hint}</span>
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
              <div className={styles.modalTitle}>{editConfig ? 'Uredi provajder' : 'Novi payment provajder'}</div>
              <button className={styles.modalClose} onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <form onSubmit={saveConfig}>
              <div className={styles.field}>
                <label>Provajder</label>
                <select value={configForm.provider} onChange={e => setConfigForm(f => ({ ...f, provider: e.target.value }))}>
                  <option value="stripe">Stripe (preporučeno za internacionalno)</option>
                  <option value="monri">Monri/Payten (Crna Gora / region)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Mod</label>
                <div className={styles.modeToggle}>
                  <button type="button"
                    className={`${styles.modeBtn} ${configForm.mode === 'test' ? styles.modeBtnActive : ''}`}
                    onClick={() => setConfigForm(f => ({ ...f, mode: 'test' }))}>
                    Test — za probno testiranje
                  </button>
                  <button type="button"
                    className={`${styles.modeBtn} ${configForm.mode === 'live' ? styles.modeBtnActive : ''}`}
                    onClick={() => setConfigForm(f => ({ ...f, mode: 'live' }))}>
                    Live — pravo plaćanje
                  </button>
                </div>
                {configForm.mode === 'live' && (
                  <div className={styles.liveWarning}>⚠ Live mod naplaćuje prave transakcije. Provjeri da su kredencijali ispravni.</div>
                )}
              </div>
              {configError && <div className={styles.error}>{configError}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowConfigModal(false)}>Odustani</button>
                <button type="submit" className={styles.btnPrimary} disabled={configSaving}>
                  {configSaving ? 'Čuvanje...' : (editConfig ? 'Sačuvaj izmjene' : 'Dodaj provajder')}
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
                🔑 Kredencijali — {PROVIDER_LABELS[credsForConfig.provider]} ({credsForConfig.mode})
              </div>
              <button className={styles.modalClose} onClick={() => setShowCredsModal(false)}>✕</button>
            </div>
            <div className={styles.credsSecurity}>
              🔒 Kredencijali se šifruju pri čuvanju i nisu vidljivi ni administratoru.
            </div>

            {/* Pomoć tenantu — odakle ključevi + callback URL za dashboard */}
            <div style={{ background: 'var(--c-info-bg)', border: '1px solid var(--c-info-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: 'var(--c-text)' }}>
              <strong>📘 Kako popuniti</strong>
              {credsForConfig.provider === 'monri' ? (
                <ol style={{ margin: '6px 0 10px 18px', padding: 0, lineHeight: 1.6 }}>
                  <li>U Monri/banka dashboardu otvori <strong>API podešavanja</strong>.</li>
                  <li>Prekopiraj <strong>„Key"</strong> (tajni potpisni ključ) i <strong>„Authenticity token"</strong> (identifikator trgovca) u polja ispod.</li>
                  <li>Počni u <strong>Test</strong> modu (probne kartice), pa kad sve radi prebaci na <strong>Live</strong>.</li>
                </ol>
              ) : (
                <ol style={{ margin: '6px 0 10px 18px', padding: 0, lineHeight: 1.6 }}>
                  <li>U Stripe Dashboardu otvori <strong>Developers → API keys</strong> (Secret key) i <strong>Webhooks</strong> (Signing secret).</li>
                  <li>Test ključevi počinju sa <code>sk_test_</code>, live sa <code>sk_live_</code>.</li>
                </ol>
              )}
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Callback / Webhook URL — zalijepi ga u {PROVIDER_LABELS[credsForConfig.provider]} dashboard:</div>
              <code style={{ display: 'block', background: 'var(--c-bg-subtle)', padding: '6px 8px', borderRadius: 6, fontSize: 12, wordBreak: 'break-all', color: 'var(--c-text)' }}>
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments-webhook?provider={credsForConfig.provider}
              </code>
              <div style={{ color: 'var(--c-text-muted)', marginTop: 6 }}>
                {credsForConfig.provider === 'monri'
                  ? 'Monri na ovaj URL šalje potvrdu plaćanja (callback). Bez njega se rezervacija/folio neće automatski označiti kao plaćeno.'
                  : 'Stripe na ovaj URL šalje webhook događaje. Signing secret iz tog webhooka unesi gore.'}
              </div>
            </div>
            {credsSaved ? (
              <div className={styles.credsSavedMsg}>✓ Kredencijali su uspješno sačuvani.</div>
            ) : (
              <form onSubmit={saveCreds}>
                {(CREDENTIAL_FIELDS[credsForConfig.provider] || []).map(field => (
                  <div key={field.key} className={styles.field}>
                    <label>{field.label} *</label>
                    <input
                      type="password"
                      value={credsForm[field.key] || ''}
                      onChange={e => setCredsForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      autoComplete="off"
                    />
                    <div className={styles.fieldHint}>{field.hint}</div>
                  </div>
                ))}
                {credsError && <div className={styles.error}>{credsError}</div>}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowCredsModal(false)}>Odustani</button>
                  <button type="submit" className={styles.btnPrimary} disabled={credsSaving}>
                    {credsSaving ? 'Čuvanje...' : 'Sačuvaj kredencijale'}
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
