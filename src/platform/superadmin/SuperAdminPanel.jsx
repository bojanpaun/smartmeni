import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { planStatus } from '../../lib/planUtils'
import { backfillTenant } from '../../lib/contentTranslate'
import { useSortable } from '../../hooks/useSortable'
import SortableHead from '../../components/shared/SortableHead'
import styles from './SuperAdminPanel.module.css'

// labelKey reuse iz ThemePalettesAdmin (tpPal*); label fallback za skladištenje.
const ADMIN_THEMES = [
  { key: 'green',  label: 'Zelena',     labelKey: 'tpPalGreen',  color: '#0d7a52' },
  { key: 'blue',   label: 'Plava',      labelKey: 'tpPalBlue',   color: '#2563eb' },
  { key: 'purple', label: 'Ljubičasta', labelKey: 'tpPalPurple', color: '#7c3aed' },
]

const CATEGORY_KEYS = {
  restaurant: 'bcCatRestaurant',
  hotel:      'bcCatHotel',
  enterprise: 'bcCatEnterprise',
}

export default function SuperAdminPanel() {
  const { isSuperAdmin, palettes, restaurant, setRestaurant, setTenant } = usePlatform()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  // Ugrađene + custom palete (iz theme_palettes) za picker. theme_palettes može
  // sadržati i override redove za ugrađene palete (isti key) — ne dupliraj ih, samo
  // preuzmi prikazanu boju iz override-a.
  const builtinKeys = ADMIN_THEMES.map(th => th.key)
  const themeChoices = [
    ...ADMIN_THEMES.map(th => {
      const ov = (palettes ?? []).find(p => p.key === th.key)
      const label = t(th.labelKey)
      return ov ? { key: th.key, label, color: ov.light?.primary || th.color } : { key: th.key, label, color: th.color }
    }),
    ...(palettes ?? [])
      .filter(p => !builtinKeys.includes(p.key))
      .map(p => ({ key: p.key, label: p.name, color: p.light?.primary || '#0d7a52' })),
  ]

  const [restaurants, setRestaurants] = useState([])
  const [addonCatalog, setAddonCatalog] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')

  const [editingId, setEditingId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    is_complimentary: false,
    complimentary_note: '',
    plan: 'starter',
    plan_expires_at: '',
    trial_ends_at: '',
    admin_theme: 'green',
    active_addons: [],
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveErr, setSaveErr] = useState(false)
  const [translatingId, setTranslatingId] = useState(null) // restaurant_id u toku (ili 'all')
  const sort = useSortable('name', 'asc')

  useEffect(() => {
    loadRestaurants()
    loadAddonCatalog()
    loadPlans()
  }, [])

  const loadPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('id, name, price_monthly, is_active')
      .order('sort_order')
    setPlans(data || [])
  }

  const loadRestaurants = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, plan, trial_ends_at, plan_expires_at, suspended_at, is_complimentary, complimentary_note, admin_theme, color, approval_status, created_at')
      .order('created_at', { ascending: false })

    if (!error) setRestaurants(data || [])
    setLoading(false)
  }

  const loadAddonCatalog = async () => {
    const { data } = await supabase
      .from('addon_catalog')
      .select('id, name, category, price_monthly')
      .eq('is_active', true)
      .order('sort_order')
    setAddonCatalog(data || [])
  }

  const openEdit = async (rest) => {
    setEditingId(rest.id)
    setLoadingEdit(true)
    setEditForm({
      is_complimentary: rest.is_complimentary || false,
      complimentary_note: rest.complimentary_note || '',
      plan: rest.plan || 'starter',
      plan_expires_at: rest.plan_expires_at ? rest.plan_expires_at.slice(0, 10) : '',
      trial_ends_at: rest.trial_ends_at ? rest.trial_ends_at.slice(0, 10) : '',
      admin_theme: rest.admin_theme || 'green',
      active_addons: [],
    })

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('addons')
      .eq('restaurant_id', rest.id)
      .single()

    const activeAddons = Array.isArray(sub?.addons) ? sub.addons : []
    setEditForm(f => ({ ...f, active_addons: activeAddons }))
    setLoadingEdit(false)
  }

  const closeEdit = () => {
    setEditingId(null)
    setSaveMsg('')
  }

  const toggleAddon = (addonId) => {
    setEditForm(f => {
      const current = f.active_addons
      const next = current.includes(addonId)
        ? current.filter(a => a !== addonId)
        : [...current, addonId]
      return { ...f, active_addons: next }
    })
  }

  const saveEdit = async () => {
    setSaving(true)
    setSaveMsg('')

    const payload = {
      is_complimentary: editForm.is_complimentary,
      complimentary_note: editForm.is_complimentary ? editForm.complimentary_note : null,
      plan: editForm.plan,
      plan_expires_at: editForm.plan_expires_at || null,
      trial_ends_at: editForm.trial_ends_at || null,
      admin_theme: editForm.admin_theme,
    }

    if (editForm.is_complimentary) {
      payload.suspended_at = null
    }

    const { data: updated, error } = await supabase
      .from('restaurants')
      .update(payload)
      .eq('id', editingId)
      .select('id')

    if (!error && (!updated || updated.length === 0)) {
      // RLS je propustio UPDATE bez greške ali bez pogođenih redova —
      // ne tvrdi da je sačuvano, jer u bazi nema promjene.
      setSaveMsg(t('sapSaveErrRights')); setSaveErr(true)
      setSaving(false)
      return
    }

    if (!error) {
      await supabase
        .from('subscriptions')
        .upsert(
          { restaurant_id: editingId, addons: editForm.active_addons },
          { onConflict: 'restaurant_id' }
        )

      setRestaurants(rs => rs.map(r => r.id === editingId ? { ...r, ...payload } : r))

      // Ako superadmin uređuje VLASTITI nalog, osvježi PlatformContext da se tema
      // (admin_theme) i ostala account polja primijene ODMAH, bez reload-a. useTheme
      // (preko ThemeToggle) keyira na restaurant.admin_theme — bez ovoga paleta se
      // vidi tek nakon punog reload-a (loadProfile ponovo čita).
      if (editingId === restaurant?.id) {
        setRestaurant(r => r ? { ...r, ...payload } : r)
        setTenant(t => t ? { ...t, ...payload } : t)
      }

      setSaveMsg(t('sapSavedExcl')); setSaveErr(false)
      setTimeout(() => setSaveMsg(''), 2500)
    } else {
      setSaveMsg(t('saErrPrefix') + error.message); setSaveErr(true)
    }
    setSaving(false)
  }

  const toggleSuspend = async (rest) => {
    const isSuspended = !!rest.suspended_at
    const msg = isSuspended
      ? t('sapReactivateConfirm', { name: rest.name })
      : t('sapSuspendConfirm', { name: rest.name })
    if (!confirm(msg)) return

    const payload = { suspended_at: isSuspended ? null : new Date().toISOString() }
    await supabase.from('restaurants').update(payload).eq('id', rest.id)
    setRestaurants(rs => rs.map(r => r.id === rest.id ? { ...r, ...payload } : r))
  }

  const setApproval = async (rest, status) => {
    const confirmMsg = status === 'approved'
      ? t('sapApproveConfirm', { name: rest.name })
      : t('sapRejectConfirm', { name: rest.name })
    if (!confirm(confirmMsg)) return
    await supabase.from('restaurants').update({ approval_status: status }).eq('id', rest.id)
    setRestaurants(rs => rs.map(r => r.id === rest.id ? { ...r, approval_status: status } : r))
    // Email obavijest vlasniku (fire-and-forget — ne blokira UI)
    supabase.functions.invoke('send-approval-email', { body: { restaurant_id: rest.id, status } })
      .then(({ error }) => { setSaveMsg(error ? t('sapStatusChangedNoEmail') : t('sapStatusChangedEmail')); setSaveErr(false); setTimeout(() => setSaveMsg(''), 3000) })
      .catch(() => {})
  }

  // Backfill AI prevoda za JEDAN tenant (edge sam učita sve stavke + dedupe-uje).
  const translateTenant = async (rest) => {
    if (!confirm(t('sapTranslateConfirm', { name: rest.name }))) return
    setTranslatingId(rest.id)
    setSaveMsg(t('sapTranslating')); setSaveErr(false)
    try {
      const res = await backfillTenant(rest.id)
      setSaveMsg(t('sapTranslateDone', { count: res?.translated ?? 0 })); setSaveErr(false)
    } catch (err) {
      setSaveMsg(`${t('sapTranslateErr')} ${String(err?.message || err)}`); setSaveErr(true)
    }
    setTranslatingId(null)
    setTimeout(() => setSaveMsg(''), 8000)
  }

  // Backfill za SVE tenante (inicijalni rollout) — sekvencijalno, jedan po jedan.
  const translateAll = async () => {
    if (!confirm(t('sapTranslateAllConfirm', { count: restaurants.length }))) return
    setTranslatingId('all')
    setSaveMsg(t('sapTranslating')); setSaveErr(false)
    let total = 0, lastErr = null
    for (const r of restaurants) {
      try { const res = await backfillTenant(r.id); total += res?.translated ?? 0 } catch (err) { lastErr = err }
    }
    setTranslatingId(null)
    if (total === 0 && lastErr) { setSaveMsg(`${t('sapTranslateErr')} ${String(lastErr?.message || lastErr)}`); setSaveErr(true) }
    else { setSaveMsg(t('sapTranslateDone', { count: total })); setSaveErr(false) }
    setTimeout(() => setSaveMsg(''), 8000)
  }

  const PAID_PLANS = ['restaurant', 'hotel', 'hotel_pro', 'enterprise', 'pro']

  const withStatus = restaurants.map(r => ({ ...r, _status: planStatus(r) }))
  const filtered = withStatus.filter(r => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filterPlan === 'all') return true
    if (filterPlan === 'complimentary') return r.is_complimentary
    if (filterPlan === 'paid') return PAID_PLANS.includes(r.plan) && !r.is_complimentary
    if (filterPlan === 'starter') return !PAID_PLANS.includes(r.plan) && !r.is_complimentary
    if (filterPlan === 'suspended') return !!r.suspended_at
    if (filterPlan === 'pending') return r.approval_status === 'pending'
    return true
  })
  const stats = {
    total: restaurants.length,
    pro: restaurants.filter(r => PAID_PLANS.includes(r.plan) && !r.is_complimentary).length,
    complimentary: restaurants.filter(r => r.is_complimentary).length,
    suspended: restaurants.filter(r => !!r.suspended_at).length,
    pending: restaurants.filter(r => r.approval_status === 'pending').length,
  }

  const catalogByCategory = addonCatalog.reduce((acc, addon) => {
    const cat = addon.category || 'restaurant'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(addon)
    return acc
  }, {})

  if (!isSuperAdmin()) {
    return (
      <div className={styles.accessDenied}>
        <div>🔒</div>
        <div>{t('saNoAccess')}</div>
      </div>
    )
  }

  if (loading) return <div className={styles.loading}>{t('sapLoading')}</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>{t('sapTitle')}</div>
          <div className={styles.headerSub}>{t('sapSub')}</div>
        </div>
        <div className={styles.headerActions}>
          {/* Navigacija je sada u lijevom sidebar-u (Super admin modul) */}
          <button className={styles.btnRefresh} onClick={loadRestaurants}>↻ {t('sapRefresh')}</button>
          <button className={styles.btnRefresh} onClick={translateAll} disabled={translatingId !== null}>
            {translatingId === 'all' ? t('sapTranslating') : t('sapTranslateAll')}
          </button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statVal}>{stats.total}</div>
          <div className={styles.statLabel}>{t('sapTotalRest')}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{stats.pro}</div>
          <div className={styles.statLabel}>{t('sapProPaid')}</div>
        </div>
        <div className={`${styles.stat} ${styles.statComplimentary}`}>
          <div className={styles.statVal}>{stats.complimentary}</div>
          <div className={styles.statLabel}>{t('sapComplimentary')}</div>
        </div>
        <div className={`${styles.stat} ${styles.statSuspended}`}>
          <div className={styles.statVal}>{stats.suspended}</div>
          <div className={styles.statLabel}>{t('sapSuspended')}</div>
        </div>
        <div
          className={`${styles.stat} ${styles.statSuspended}`}
          style={stats.pending > 0 ? { cursor: 'pointer', borderColor: 'var(--c-warning)' } : undefined}
          onClick={() => stats.pending > 0 && setFilterPlan('pending')}
        >
          <div className={styles.statVal} style={stats.pending > 0 ? { color: 'var(--c-warning)' } : undefined}>{stats.pending}</div>
          <div className={styles.statLabel}>⏳ {t('sapPending')}</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder={t('sapSearchPh')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterBtns}>
          {[
            { key: 'all',           label: t('sapFilterAll') },
            { key: 'paid',          label: t('sapFilterPaid') },
            { key: 'complimentary', label: t('sapFilterComp') },
            { key: 'starter',       label: t('sapFilterStarter') },
            { key: 'suspended',     label: t('sapFilterSuspended') },
            { key: 'pending',       label: t('sapFilterPending') },
          ].map(f => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filterPlan === f.key ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterPlan(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th><SortableHead col="name"       label={t('sapColRest')}       sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
              <th><SortableHead col="plan"       label={t('sapColPlan')}       sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
              <th><SortableHead col="_status"    label={t('sapColStatus')}     sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
              <th><SortableHead col="created_at" label={t('sapColRegistered')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
              <th>{t('sapColActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>{t('saNoResults')}</td>
              </tr>
            )}
            {sort.sort(filtered).map(rest => (
                <tr key={rest.id} className={editingId === rest.id ? styles.rowEditing : ''}>
                  <td>
                    <div className={styles.restName}>
                      {rest.name}
                      {rest.approval_status === 'pending' && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--c-warning)', background: 'var(--c-warning-bg)', border: '1px solid var(--c-warning-border)', borderRadius: 12, padding: '1px 8px' }}>⏳ {t('sapPendingBadge')}</span>
                      )}
                      {rest.approval_status === 'rejected' && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--c-danger)', background: 'var(--c-danger-bg)', border: '1px solid var(--c-danger-border)', borderRadius: 12, padding: '1px 8px' }}>✕ {t('sapRejectedBadge')}</span>
                      )}
                    </div>
                    <div className={styles.restSlug}>restby.me/{rest.slug}</div>
                    <ThemeDot theme={rest.admin_theme} color={rest.color} />
                    <div className={styles.mobileInfo}>
                      <PlanBadge rest={rest} />
                      <StatusBadge status={rest._status} />
                    </div>
                  </td>
                  <td><PlanBadge rest={rest} /></td>
                  <td><StatusBadge status={rest._status} /></td>
                  <td className={styles.dateCell}>
                    {new Date(rest.created_at).toLocaleDateString(dl, {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })}
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      {rest.approval_status === 'pending' && (
                        <>
                          <button
                            className={styles.btnEdit}
                            style={{ background: 'var(--c-success)', color: '#fff', borderColor: 'var(--c-success)' }}
                            onClick={() => setApproval(rest, 'approved')}
                          >
                            ✓ {t('sapApprove')}
                          </button>
                          <button
                            className={styles.btnSuspend}
                            onClick={() => setApproval(rest, 'rejected')}
                          >
                            ✕ {t('sapReject')}
                          </button>
                        </>
                      )}
                      {rest.approval_status === 'rejected' && (
                        <button
                          className={styles.btnEdit}
                          style={{ background: 'var(--c-success)', color: '#fff', borderColor: 'var(--c-success)' }}
                          onClick={() => setApproval(rest, 'approved')}
                        >
                          ✓ {t('sapApproveAnyway')}
                        </button>
                      )}
                      <button
                        className={styles.btnEdit}
                        onClick={() => editingId === rest.id ? closeEdit() : openEdit(rest)}
                      >
                        {editingId === rest.id ? t('sapClose') : t('sapEditPlan')}
                      </button>
                      <button
                        className={`${styles.btnSuspend} ${rest.suspended_at ? styles.btnUnsuspend : ''}`}
                        onClick={() => toggleSuspend(rest)}
                      >
                        {rest.suspended_at ? `✓ ${t('sapReactivate')}` : `⊘ ${t('sapSuspend')}`}
                      </button>
                      <button
                        className={styles.btnEdit}
                        onClick={() => translateTenant(rest)}
                        disabled={translatingId !== null}
                      >
                        {translatingId === rest.id ? t('sapTranslating') : t('sapTranslate')}
                      </button>
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className={styles.editPanel}>
          <div className={styles.editPanelHeader}>
            <div className={styles.editPanelTitle}>
              {t('sapEditPlanFor')} <strong>{restaurants.find(r => r.id === editingId)?.name}</strong>
            </div>
            <button className={styles.editPanelClose} onClick={closeEdit}>✕</button>
          </div>

          <div className={styles.editGrid}>

            {/* Complimentary toggle */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>🎁 {t('sapFreePro')}</div>
              <label className={styles.toggleLabel}>
                <div
                  className={`${styles.toggle} ${editForm.is_complimentary ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setEditForm(f => ({ ...f, is_complimentary: !f.is_complimentary }))}
                />
                <span>
                  {editForm.is_complimentary
                    ? t('sapCompActive')
                    : t('sapCompInactive')}
                </span>
              </label>

              {editForm.is_complimentary && (
                <div className={styles.field}>
                  <label>{t('sapReasonNote')}</label>
                  <input
                    placeholder={t('sapReasonPh')}
                    value={editForm.complimentary_note}
                    onChange={e => setEditForm(f => ({ ...f, complimentary_note: e.target.value }))}
                  />
                  <div className={styles.fieldHint}>
                    {t('sapReasonHint')}
                  </div>
                </div>
              )}
            </div>

            {/* Tema admin panela */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>🎨 {t('sapTheme')}</div>
              <div className={styles.themeOptions}>
                {/* Brend — izvedeno uživo iz boje brenda ovog tenanta (restaurants.color) */}
                <button
                  key="brand"
                  className={`${styles.themeOption} ${editForm.admin_theme === 'brand' ? styles.themeOptionActive : ''}`}
                  onClick={() => setEditForm(f => ({ ...f, admin_theme: 'brand' }))}
                  title={t('sapBrandTitle')}
                >
                  <span className={styles.themeOptionDot} style={{ background: restaurants.find(r => r.id === editingId)?.color || '#0d7a52' }} />
                  {t('sapBrand')}
                </button>
                {themeChoices.map(th => (
                  <button
                    key={th.key}
                    className={`${styles.themeOption} ${editForm.admin_theme === th.key ? styles.themeOptionActive : ''}`}
                    onClick={() => setEditForm(f => ({ ...f, admin_theme: th.key }))}
                  >
                    <span className={styles.themeOptionDot} style={{ background: th.color }} />
                    {th.label}
                  </button>
                ))}
              </div>
              <button onClick={() => navigate('/superadmin/theme')}
                style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                + {t('sapManageCustom')} →
              </button>
            </div>

            {/* Plan override */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>📋 {t('sapPlanOverride')}</div>
              <div className={styles.field}>
                <label>{t('sapActivePlan')}</label>
                <select
                  value={editForm.plan}
                  onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                >
                  {plans.map(pl => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}{pl.price_monthly ? ` — €${pl.price_monthly}${t('sapPerMonthShort')}` : pl.id === 'starter' ? ` ${t('sapFree')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>{t('sapProExpires')}</label>
                <input
                  type="date"
                  value={editForm.plan_expires_at}
                  onChange={e => setEditForm(f => ({ ...f, plan_expires_at: e.target.value }))}
                />
                <div className={styles.fieldHint}>{t('sapNoExpiryHint')}</div>
              </div>
              <div className={styles.field}>
                <label>{t('sapTrialExpires')}</label>
                <input
                  type="date"
                  value={editForm.trial_ends_at}
                  onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                />
              </div>
            </div>

            {/* Addon override — spans full width */}
            <div className={`${styles.editSection} ${styles.addonSection}`}>
              <div className={styles.editSectionTitle}>🧩 {t('sapAddonOverride')}</div>
              <div className={styles.fieldHint} style={{ marginBottom: 16 }}>
                {t('sapAddonHint')}
              </div>

              {loadingEdit ? (
                <div className={styles.addonLoading}>{t('loading')}</div>
              ) : (
                <div className={styles.addonCategories}>
                  {Object.entries(catalogByCategory).map(([category, addons]) => (
                    <div key={category} className={styles.addonCategoryGroup}>
                      <div className={styles.addonCategoryLabel}>
                        {CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category}
                      </div>
                      <div className={styles.addonToggles}>
                        {addons.map(addon => {
                          const isActive = editForm.active_addons.includes(addon.id)
                          return (
                            <label
                              key={addon.id}
                              className={styles.addonToggleRow}
                              onClick={() => toggleAddon(addon.id)}
                            >
                              <div className={`${styles.toggle} ${isActive ? styles.toggleOn : styles.toggleOff}`} />
                              <span className={styles.addonToggleName}>{addon.name}</span>
                              <span className={styles.addonTogglePrice}>€{addon.price_monthly}{t('sapPerMonthShort')}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className={styles.editActions}>
            <button className={styles.btnCancel} onClick={closeEdit}>{t('cancel')}</button>
            <button className={styles.btnSave} onClick={saveEdit} disabled={saving}>
              {saving ? t('saving') : t('spaSaveChanges')}
            </button>
            {saveMsg && (
              <span className={saveErr ? styles.msgError : styles.msgOk}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

function ThemeDot({ theme, color }) {
  const { t } = useTranslation('admin')
  // 'brand' = izvedeno iz boje brenda tenanta; ostalo = ugrađene palete.
  if (theme === 'brand') {
    return <span className={styles.themeDot} style={{ background: color || '#0d7a52' }} title={t('sapThemeBrand')} />
  }
  const th = ADMIN_THEMES.find(x => x.key === (theme || 'green')) || ADMIN_THEMES[0]
  return (
    <span className={styles.themeDot} style={{ background: th.color }} title={t('sapThemeTitle', { name: t(th.labelKey) })} />
  )
}

const PLAN_LABEL_KEYS = {
  starter:    'sapPlanStarter',
  restaurant: 'sapPlanRestaurant',
  hotel:      'sapPlanHotel',
  hotel_pro:  'sapPlanHotelPro',
  enterprise: 'sapPlanEnterprise',
  pro:        'sapPlanRestaurant', // backward compat
}

function PlanBadge({ rest }) {
  const { t } = useTranslation('admin')
  if (rest.is_complimentary) {
    return <span className={`${styles.badge} ${styles.badgeComplimentary}`}>🎁 {t('sapComplimentary')}</span>
  }
  const plan = rest.plan || 'starter'
  const isPaid = ['restaurant', 'hotel', 'hotel_pro', 'enterprise', 'pro'].includes(plan)
  return (
    <span className={`${styles.badge} ${isPaid ? styles.badgePro : styles.badgeStarter}`}>
      {PLAN_LABEL_KEYS[plan] ? t(PLAN_LABEL_KEYS[plan]) : plan}
    </span>
  )
}

function StatusBadge({ status }) {
  const { t } = useTranslation('admin')
  const map = {
    complimentary: { labelKey: 'sapStActive',    cls: styles.statusActive },
    pro:           { labelKey: 'sapStActive',    cls: styles.statusActive },
    trial:         { labelKey: 'sapStTrial',     cls: styles.statusTrial },
    expired:       { labelKey: 'sapStExpired',   cls: styles.statusExpired },
    suspended:     { labelKey: 'sapStSuspended', cls: styles.statusSuspended },
    starter:       { labelKey: 'sapStStarter',   cls: styles.statusStarter },
  }
  const { labelKey, cls } = map[status] || map.starter
  return <span className={`${styles.statusPill} ${cls}`}>{t(labelKey)}</span>
}
