import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './BillingControl.module.css'

const CATEGORY_KEYS = {
  restaurant: 'bcCatRestaurant',
  hotel:      'bcCatHotel',
  rental:     'bcCatRental',
  enterprise: 'bcCatEnterprise',
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

const arrToLines = (a) => (Array.isArray(a) ? a.join('\n') : '')
const linesToArr = (s) => (s || '').split('\n').map(x => x.trim()).filter(Boolean)
const slugifyId = (s) => (s || '').toLowerCase().trim()
  .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)

export default function BillingControl() {
  const { isSuperAdmin, user } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  const [settings, setSettings] = useState({ beta_free_mode: false, beta_note: '' })
  const [msgErr, setMsgErr] = useState(false)
  const [addons, setAddons] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [planForm, setPlanForm] = useState(null)   // null | objekat (edit/new)
  const [planIsNew, setPlanIsNew] = useState(false)
  const [addonForm, setAddonForm] = useState(null)  // null | objekat
  const [modalSaving, setModalSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: s }, { data: a }, { data: p }] = await Promise.all([
      supabase.from('platform_settings').select('beta_free_mode, beta_note').limit(1).maybeSingle(),
      // Superadmin vidi i neaktivne (FOR ALL politika) — ne filtriramo is_active.
      supabase.from('addon_catalog')
        .select('id, name, category, description, features, price_monthly, price_yearly, is_active, beta_free, beta_restricted, sort_order')
        .order('sort_order'),
      supabase.from('plans')
        .select('id, name, description, features, color, includes, is_popular, coming_soon, price_monthly, price_annual_per_month, price_annual_total, is_active, sort_order, paypal_plan_id, stripe_price_id_monthly, stripe_price_id_yearly')
        .order('sort_order'),
    ])
    setSettings(s ?? { beta_free_mode: false, beta_note: '' })
    setAddons(a ?? [])
    setPlans(p ?? [])
    setLoading(false)
  }

  const flash = (m, isErr = false) => { setMsg(m); setMsgErr(isErr); setTimeout(() => setMsg(''), 2800) }

  const saveBeta = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { data, error } = await supabase.from('platform_settings')
      .update({
        beta_free_mode: next.beta_free_mode,
        beta_note: next.beta_note || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq('id', true)
      .select('id')
    if (!error && (!data || data.length === 0)) return flash(t('saErrPrefix') + t('bcRightsLong'), true)
    flash(error ? t('saErrPrefix') + error.message : t('bcSavedDot'), !!error)
  }

  const patchAddon = (id, patch) => setAddons(list => list.map(a => a.id === id ? { ...a, ...patch } : a))
  const saveAddon = async (a) => {
    setSavingId(a.id)
    const { data, error } = await supabase.from('addon_catalog')
      .update({
        price_monthly: numOrNull(a.price_monthly),
        price_yearly: numOrNull(a.price_yearly),
        is_active: a.is_active,
        beta_free: a.beta_free,
        beta_restricted: a.beta_restricted,
      })
      .eq('id', a.id)
      .select('id')
    setSavingId(null)
    if (!error && (!data || data.length === 0)) return flash(t('saErrPrefix') + t('bcRightsShort'), true)
    flash(error ? t('saErrPrefix') + error.message : t('bcSavedName', { name: a.name }), !!error)
  }

  const patchPlan = (id, patch) => setPlans(list => list.map(p => p.id === id ? { ...p, ...patch } : p))
  const savePlan = async (p) => {
    setSavingId(p.id)
    const { data, error } = await supabase.from('plans')
      .update({
        price_monthly: numOrNull(p.price_monthly),
        price_annual_per_month: numOrNull(p.price_annual_per_month),
        price_annual_total: numOrNull(p.price_annual_total),
        is_active: p.is_active,
      })
      .eq('id', p.id)
      .select('id')
    setSavingId(null)
    if (!error && (!data || data.length === 0)) return flash(t('saErrPrefix') + t('bcRightsShort'), true)
    flash(error ? t('saErrPrefix') + error.message : t('bcSavedName', { name: p.name }), !!error)
  }

  // ─── Plan editor (kreiranje / puno uređivanje) ───────────────────────────
  const openNewPlan = () => {
    setPlanIsNew(true)
    setPlanForm({
      id: '', name: '', description: '', featuresText: '', color: '#0d7a52',
      price_monthly: '', price_annual_per_month: '', price_annual_total: '',
      includes: [], allIncluded: false,
      is_active: true, is_popular: false, coming_soon: false,
      sort_order: plans.length * 10,
      paypal_plan_id: '', stripe_price_id_monthly: '', stripe_price_id_yearly: '',
    })
  }
  const openEditPlan = (p) => {
    setPlanIsNew(false)
    setPlanForm({
      id: p.id, name: p.name || '', description: p.description || '',
      featuresText: arrToLines(p.features), color: p.color || '#0d7a52',
      price_monthly: p.price_monthly ?? '', price_annual_per_month: p.price_annual_per_month ?? '',
      price_annual_total: p.price_annual_total ?? '',
      includes: Array.isArray(p.includes) ? p.includes : [],
      allIncluded: p.includes === null,
      is_active: p.is_active, is_popular: p.is_popular, coming_soon: p.coming_soon,
      sort_order: p.sort_order ?? 0,
      paypal_plan_id: p.paypal_plan_id || '',
      stripe_price_id_monthly: p.stripe_price_id_monthly || '',
      stripe_price_id_yearly: p.stripe_price_id_yearly || '',
    })
  }
  const pf = (patch) => setPlanForm(f => ({ ...f, ...patch }))
  const toggleInclude = (addonId) => setPlanForm(f => ({
    ...f,
    includes: f.includes.includes(addonId) ? f.includes.filter(x => x !== addonId) : [...f.includes, addonId],
  }))

  const savePlanFull = async () => {
    const f = planForm
    const id = planIsNew ? slugifyId(f.id || f.name) : f.id
    if (!id) return flash(t('saErrPrefix') + t('bcIdNameReq'), true)
    if (!f.name.trim()) return flash(t('saErrPrefix') + t('bcNameReq'), true)
    setModalSaving(true)
    const payload = {
      id, name: f.name.trim(), description: f.description || null,
      features: linesToArr(f.featuresText), color: f.color || null,
      price_monthly: numOrNull(f.price_monthly),
      price_annual_per_month: numOrNull(f.price_annual_per_month),
      price_annual_total: numOrNull(f.price_annual_total),
      includes: f.allIncluded ? null : f.includes,
      is_active: f.is_active, is_popular: f.is_popular, coming_soon: f.coming_soon,
      sort_order: numOrNull(f.sort_order) ?? 0,
      paypal_plan_id: f.paypal_plan_id || null,
      stripe_price_id_monthly: f.stripe_price_id_monthly || null,
      stripe_price_id_yearly: f.stripe_price_id_yearly || null,
    }
    const { data, error } = await supabase.from('plans').upsert(payload, { onConflict: 'id' }).select('id')
    setModalSaving(false)
    if (error) return flash(t('saErrPrefix') + error.message, true)
    if (!data?.length) return flash(t('saErrPrefix') + t('bcRightsShort'), true)
    setPlanForm(null)
    flash(t('bcSavedName', { name: payload.name }))
    load()
  }

  // ─── Addon editor (opis + funkcije) ──────────────────────────────────────
  const openEditAddon = (a) => setAddonForm({
    id: a.id, name: a.name, description: a.description || '', featuresText: arrToLines(a.features),
  })
  const saveAddonFull = async () => {
    const f = addonForm
    setModalSaving(true)
    const { data, error } = await supabase.from('addon_catalog')
      .update({ description: f.description || null, features: linesToArr(f.featuresText) })
      .eq('id', f.id).select('id')
    setModalSaving(false)
    if (error) return flash(t('saErrPrefix') + error.message, true)
    if (!data?.length) return flash(t('saErrPrefix') + t('bcRightsShort'), true)
    setAddonForm(null)
    flash(t('bcSavedName', { name: f.name }))
    load()
  }

  if (!isSuperAdmin()) {
    return (
      <div className={styles.accessDenied}>
        <div>🔒</div>
        <div>{t('saNoAccess')}</div>
      </div>
    )
  }
  if (loading) return <div className={styles.loading}>{t('bcLoading')}</div>

  const addonsByCat = addons.reduce((acc, a) => {
    const c = a.category || 'restaurant'
    ;(acc[c] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>{t('bcTitle')}</div>
          <div className={styles.headerSub}>{t('bcSub')}</div>
        </div>
        <button className={styles.btnGhost} onClick={() => navigate('/superadmin')}>← {t('saBackSuper')}</button>
      </div>

      {msg && (
        <div className={msgErr ? styles.toastErr : styles.toastOk}>{msg}</div>
      )}

      {/* ─── GLOBALNI BETA PREKIDAČ ─────────────────────────────── */}
      <section className={`${styles.card} ${settings.beta_free_mode ? styles.cardBetaOn : ''}`}>
        <div className={styles.betaHead}>
          <div>
            <div className={styles.cardTitle}>🧪 {t('bcBetaTitle')}</div>
            <div className={styles.cardSub}>
              {t('bcBetaDescPre')}<strong>{t('bcBetaDescStrong')}</strong>{t('bcBetaDescPost')}
            </div>
          </div>
          <Toggle on={settings.beta_free_mode} onClick={() => saveBeta({ beta_free_mode: !settings.beta_free_mode })} big />
        </div>
        {settings.beta_free_mode && (
          <div className={styles.betaLiveWarn}>{t('bcBetaActiveWarn')}</div>
        )}
        <div className={styles.field}>
          <label>{t('bcInternalNote')}</label>
          <div className={styles.noteRow}>
            <input
              placeholder={t('bcBetaNotePh')}
              value={settings.beta_note || ''}
              onChange={e => setSettings(s => ({ ...s, beta_note: e.target.value }))}
            />
            <button className={styles.btnSave} onClick={() => saveBeta({})}>{t('save')}</button>
          </div>
        </div>
      </section>

      {/* ─── PLANOVI ────────────────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>📦 {t('bcPlansTitle')}</div>
            <div className={styles.cardSub}>{t('bcPlansSub')}</div>
          </div>
          <button className={styles.btnNew} onClick={openNewPlan}>+ {t('bcNewPlan')}</button>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('bcColPlan')}</th>
                <th>{t('bcColPerMonth')}</th>
                <th>{t('bcColPerMonthYear')}</th>
                <th>{t('bcColYearTotal')}</th>
                <th>{t('bcColActive')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id}>
                  <td className={styles.nameCell}>{p.name}<span className={styles.idTag}>{p.id}</span></td>
                  <td data-label={t('bcColPerMonth')}><PriceInput value={p.price_monthly} onChange={v => patchPlan(p.id, { price_monthly: v })} /></td>
                  <td data-label={t('bcColPerMonthYear')}><PriceInput value={p.price_annual_per_month} onChange={v => patchPlan(p.id, { price_annual_per_month: v })} /></td>
                  <td data-label={t('bcColYearTotal')}><PriceInput value={p.price_annual_total} onChange={v => patchPlan(p.id, { price_annual_total: v })} /></td>
                  <td data-label={t('bcColActive')}><Toggle on={p.is_active} onClick={() => patchPlan(p.id, { is_active: !p.is_active })} /></td>
                  <td className={styles.saveCell}>
                    <div className={styles.rowBtns}>
                      <button className={styles.btnEdit} onClick={() => openEditPlan(p)}>{t('htEdit')}</button>
                      <button className={styles.btnSave} disabled={savingId === p.id} onClick={() => savePlan(p)}>
                        {savingId === p.id ? '…' : t('save')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── ADDONI ─────────────────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.cardTitle}>🧩 {t('bcAddonsTitle')}</div>
        <div className={styles.cardSub}>
          <strong>{t('bcAddonActive')}</strong>{t('bcAddonActiveDesc')}<strong>{t('bcBetaFree')}</strong>{t('bcBetaFreeDesc')}<strong>{t('bcRestricted')}</strong>{t('bcRestrictedDesc')}
        </div>
        {Object.entries(addonsByCat).map(([cat, list]) => (
          <div key={cat} className={styles.catGroup}>
            <div className={styles.catLabel}>{CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}</div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('bcColAddon')}</th>
                    <th>{t('bcColPerMonth')}</th>
                    <th>{t('bcColPerYear')}</th>
                    <th>{t('bcColActive')}</th>
                    <th>{t('bcColBetaFree')}</th>
                    <th>{t('bcColRestricted')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(a => (
                    <tr key={a.id} className={a.beta_free ? styles.rowBeta : ''}>
                      <td className={styles.nameCell}>{a.name}<span className={styles.idTag}>{a.id}</span></td>
                      <td data-label={t('bcColPerMonth')}><PriceInput value={a.price_monthly} onChange={v => patchAddon(a.id, { price_monthly: v })} /></td>
                      <td data-label={t('bcColPerYear')}><PriceInput value={a.price_yearly} onChange={v => patchAddon(a.id, { price_yearly: v })} /></td>
                      <td data-label={t('bcColActive')}><Toggle on={a.is_active} onClick={() => patchAddon(a.id, { is_active: !a.is_active })} /></td>
                      <td data-label={t('bcColBetaFree')}><Toggle on={a.beta_free} onClick={() => patchAddon(a.id, { beta_free: !a.beta_free })} /></td>
                      <td data-label={t('bcColRestricted')}><Toggle on={a.beta_restricted} onClick={() => patchAddon(a.id, { beta_restricted: !a.beta_restricted })} /></td>
                      <td className={styles.saveCell}>
                        <div className={styles.rowBtns}>
                          <button className={styles.btnEdit} onClick={() => openEditAddon(a)}>{t('htEdit')}</button>
                          <button className={styles.btnSave} disabled={savingId === a.id} onClick={() => saveAddon(a)}>
                            {savingId === a.id ? '…' : t('save')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* ─── PLAN EDITOR MODAL ──────────────────────────────────── */}
      {planForm && (
        <div className={styles.overlay} onClick={() => setPlanForm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{planIsNew ? t('bcNewPlan') : t('bcEditPlanTitle', { name: planForm.name })}</div>
              <button className={styles.modalClose} onClick={() => setPlanForm(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>{t('bcIdLabel')} {planIsNew ? t('bcSlugSuffix') : ''}</label>
                  {planIsNew
                    ? <input value={planForm.id} placeholder={t('bcIdPh')} onChange={e => pf({ id: e.target.value })} />
                    : <div className={styles.idFixed}>{planForm.id}</div>}
                </div>
                <div className={styles.field}>
                  <label>{t('saNameLabel')}</label>
                  <input value={planForm.name} onChange={e => pf({ name: e.target.value })} />
                </div>
              </div>

              <div className={styles.field}>
                <label>{t('bcShortDesc')}</label>
                <input value={planForm.description} placeholder={t('bcShortDescPh')} onChange={e => pf({ description: e.target.value })} />
              </div>

              <div className={styles.field}>
                <label>{t('bcFeatures')}</label>
                <textarea rows={6} value={planForm.featuresText}
                  onChange={e => pf({ featuresText: e.target.value })} />
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>{t('bcColPerMonth')}</label>
                  <PriceInput value={planForm.price_monthly} onChange={v => pf({ price_monthly: v })} />
                </div>
                <div className={styles.field}>
                  <label>{t('bcColPerMonthYear')}</label>
                  <PriceInput value={planForm.price_annual_per_month} onChange={v => pf({ price_annual_per_month: v })} />
                </div>
                <div className={styles.field}>
                  <label>{t('bcColYearTotal')}</label>
                  <PriceInput value={planForm.price_annual_total} onChange={v => pf({ price_annual_total: v })} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>{t('bcColor')}</label>
                  <input type="color" value={planForm.color} onChange={e => pf({ color: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>{t('saSortOrder')}</label>
                  <input type="number" value={planForm.sort_order} onChange={e => pf({ sort_order: e.target.value })} />
                </div>
              </div>

              <div className={styles.toggleRow}>
                <Toggle on={planForm.is_active} onClick={() => pf({ is_active: !planForm.is_active })} /> <span>{t('spaActiveM')}</span>
                <Toggle on={planForm.is_popular} onClick={() => pf({ is_popular: !planForm.is_popular })} /> <span>{t('bcPopular')}</span>
                <Toggle on={planForm.coming_soon} onClick={() => pf({ coming_soon: !planForm.coming_soon })} /> <span>{t('bcComingSoon')}</span>
              </div>

              <div className={styles.field}>
                <label>{t('bcIncludedModules')}</label>
                <label className={styles.allInc}>
                  <input type="checkbox" checked={planForm.allIncluded} onChange={e => pf({ allIncluded: e.target.checked })} />
                  {t('bcAllAddons')}
                </label>
                {!planForm.allIncluded && (
                  <div className={styles.incGrid}>
                    {addons.map(a => (
                      <label key={a.id} className={`${styles.incChip} ${planForm.includes.includes(a.id) ? styles.incChipOn : ''}`}>
                        <input type="checkbox" checked={planForm.includes.includes(a.id)} onChange={() => toggleInclude(a.id)} />
                        {a.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.providerBox}>
                <div className={styles.providerTitle}>{t('bcProviderTitle')}</div>
                <div className={styles.field}>
                  <label>{t('bcPaypalId')}</label>
                  <input value={planForm.paypal_plan_id} placeholder="P-XXXXXXXX" onChange={e => pf({ paypal_plan_id: e.target.value })} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label>{t('bcStripeMonthly')}</label>
                    <input value={planForm.stripe_price_id_monthly} placeholder="price_..." onChange={e => pf({ stripe_price_id_monthly: e.target.value })} />
                  </div>
                  <div className={styles.field}>
                    <label>{t('bcStripeYearly')}</label>
                    <input value={planForm.stripe_price_id_yearly} placeholder="price_..." onChange={e => pf({ stripe_price_id_yearly: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.btnGhost} onClick={() => setPlanForm(null)}>{t('cancel')}</button>
              <button className={styles.btnSave} disabled={modalSaving} onClick={savePlanFull}>
                {modalSaving ? t('saving') : t('bcSavePlan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADDON EDITOR MODAL ─────────────────────────────────── */}
      {addonForm && (
        <div className={styles.overlay} onClick={() => setAddonForm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{t('bcEditAddonTitle', { name: addonForm.name })}</div>
              <button className={styles.modalClose} onClick={() => setAddonForm(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>{t('bcDescLabel')}</label>
                <textarea rows={3} value={addonForm.description}
                  onChange={e => setAddonForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t('bcFeatures')}</label>
                <textarea rows={6} value={addonForm.featuresText}
                  onChange={e => setAddonForm(f => ({ ...f, featuresText: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className={styles.btnGhost} onClick={() => setAddonForm(null)}>{t('cancel')}</button>
              <button className={styles.btnSave} disabled={modalSaving} onClick={saveAddonFull}>
                {modalSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PriceInput({ value, onChange }) {
  return (
    <input
      className={styles.priceInput}
      type="number"
      min="0"
      step="1"
      inputMode="decimal"
      placeholder="—"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function Toggle({ on, onClick, big }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      className={`${styles.toggle} ${on ? styles.toggleOn : styles.toggleOff} ${big ? styles.toggleBig : ''}`}
      onClick={onClick}
    />
  )
}
