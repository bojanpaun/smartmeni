import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { planStatus } from '../../lib/planUtils'
import styles from './SuperAdminPanel.module.css'

const ADMIN_THEMES = [
  { key: 'green', label: 'Zelena', color: '#0d7a52' },
  { key: 'blue',  label: 'Plava',  color: '#2563eb' },
]

const CATEGORY_LABELS = {
  restaurant: '🍽️ Restoran',
  hotel:      '🏨 Hotel',
  enterprise: '🏢 Enterprise',
}

export default function SuperAdminPanel() {
  const { isSuperAdmin } = usePlatform()

  const [restaurants, setRestaurants] = useState([])
  const [addonCatalog, setAddonCatalog] = useState([])
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

  useEffect(() => {
    loadRestaurants()
    loadAddonCatalog()
  }, [])

  const loadRestaurants = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, plan, trial_ends_at, plan_expires_at, suspended_at, is_complimentary, complimentary_note, admin_theme, created_at')
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

    const { error } = await supabase
      .from('restaurants')
      .update(payload)
      .eq('id', editingId)

    if (!error) {
      await supabase
        .from('subscriptions')
        .upsert(
          { restaurant_id: editingId, addons: editForm.active_addons },
          { onConflict: 'restaurant_id' }
        )

      setRestaurants(rs => rs.map(r => r.id === editingId ? { ...r, ...payload } : r))
      setSaveMsg('Sačuvano!')
      setTimeout(() => setSaveMsg(''), 2500)
    } else {
      setSaveMsg('Greška: ' + error.message)
    }
    setSaving(false)
  }

  const toggleSuspend = async (rest) => {
    const isSuspended = !!rest.suspended_at
    const msg = isSuspended
      ? `Reaktivirati nalog "${rest.name}"?`
      : `Suspendovati nalog "${rest.name}"? Korisnik neće moći pristupiti admin panelu.`
    if (!confirm(msg)) return

    const payload = { suspended_at: isSuspended ? null : new Date().toISOString() }
    await supabase.from('restaurants').update(payload).eq('id', rest.id)
    setRestaurants(rs => rs.map(r => r.id === rest.id ? { ...r, ...payload } : r))
  }

  const filtered = restaurants.filter(r => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filterPlan === 'all') return true
    if (filterPlan === 'complimentary') return r.is_complimentary
    if (filterPlan === 'pro') return r.plan === 'pro' && !r.is_complimentary
    if (filterPlan === 'starter') return r.plan !== 'pro' && !r.is_complimentary
    if (filterPlan === 'suspended') return !!r.suspended_at
    return true
  })

  const stats = {
    total: restaurants.length,
    pro: restaurants.filter(r => r.plan === 'pro' && !r.is_complimentary).length,
    complimentary: restaurants.filter(r => r.is_complimentary).length,
    suspended: restaurants.filter(r => !!r.suspended_at).length,
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
        <div>Nemate pristup ovoj stranici.</div>
      </div>
    )
  }

  if (loading) return <div className={styles.loading}>Učitavanje restorana...</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Super admin panel</div>
          <div className={styles.headerSub}>Upravljanje restoranima i planovima</div>
        </div>
        <button className={styles.btnRefresh} onClick={loadRestaurants}>↻ Osvježi</button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statVal}>{stats.total}</div>
          <div className={styles.statLabel}>Ukupno restorana</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statVal}>{stats.pro}</div>
          <div className={styles.statLabel}>Pro (plaćeni)</div>
        </div>
        <div className={`${styles.stat} ${styles.statComplimentary}`}>
          <div className={styles.statVal}>{stats.complimentary}</div>
          <div className={styles.statLabel}>Complimentary</div>
        </div>
        <div className={`${styles.stat} ${styles.statSuspended}`}>
          <div className={styles.statVal}>{stats.suspended}</div>
          <div className={styles.statLabel}>Suspendirani</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Pretraži po nazivu ili slug-u..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterBtns}>
          {[
            { key: 'all',           label: 'Svi' },
            { key: 'pro',           label: 'Pro' },
            { key: 'complimentary', label: '🎁 Complimentary' },
            { key: 'starter',       label: 'Starter' },
            { key: 'suspended',     label: '⚠️ Suspendirani' },
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
              <th>Restoran</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Registrovan</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>Nema rezultata.</td>
              </tr>
            )}
            {filtered.map(rest => {
              const status = planStatus(rest)
              return (
                <tr key={rest.id} className={editingId === rest.id ? styles.rowEditing : ''}>
                  <td>
                    <div className={styles.restName}>{rest.name}</div>
                    <div className={styles.restSlug}>smartmeni.me/{rest.slug}</div>
                    <ThemeDot theme={rest.admin_theme} />
                  </td>
                  <td><PlanBadge rest={rest} /></td>
                  <td><StatusBadge status={status} /></td>
                  <td className={styles.dateCell}>
                    {new Date(rest.created_at).toLocaleDateString('sr-Latn', {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })}
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button
                        className={styles.btnEdit}
                        onClick={() => editingId === rest.id ? closeEdit() : openEdit(rest)}
                      >
                        {editingId === rest.id ? 'Zatvori' : 'Uredi plan'}
                      </button>
                      <button
                        className={`${styles.btnSuspend} ${rest.suspended_at ? styles.btnUnsuspend : ''}`}
                        onClick={() => toggleSuspend(rest)}
                      >
                        {rest.suspended_at ? '✓ Reaktiviraj' : '⊘ Suspenduj'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className={styles.editPanel}>
          <div className={styles.editPanelHeader}>
            <div className={styles.editPanelTitle}>
              Uredi plan — <strong>{restaurants.find(r => r.id === editingId)?.name}</strong>
            </div>
            <button className={styles.editPanelClose} onClick={closeEdit}>✕</button>
          </div>

          <div className={styles.editGrid}>

            {/* Complimentary toggle */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>🎁 Besplatni Pro pristup</div>
              <label className={styles.toggleLabel}>
                <div
                  className={`${styles.toggle} ${editForm.is_complimentary ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setEditForm(f => ({ ...f, is_complimentary: !f.is_complimentary }))}
                />
                <span>
                  {editForm.is_complimentary
                    ? 'Aktivan — korisnik ima puni Pro pristup besplatno'
                    : 'Nije aktivan'}
                </span>
              </label>

              {editForm.is_complimentary && (
                <div className={styles.field}>
                  <label>Razlog (napomena)</label>
                  <input
                    placeholder="npr. Beta tester, Partner restoran, Nagradni period..."
                    value={editForm.complimentary_note}
                    onChange={e => setEditForm(f => ({ ...f, complimentary_note: e.target.value }))}
                  />
                  <div className={styles.fieldHint}>
                    Napomena je vidljiva korisniku na Billing stranici.
                  </div>
                </div>
              )}
            </div>

            {/* Tema admin panela */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>🎨 Tema admin panela</div>
              <div className={styles.themeOptions}>
                {ADMIN_THEMES.map(t => (
                  <button
                    key={t.key}
                    className={`${styles.themeOption} ${editForm.admin_theme === t.key ? styles.themeOptionActive : ''}`}
                    onClick={() => setEditForm(f => ({ ...f, admin_theme: t.key }))}
                  >
                    <span className={styles.themeOptionDot} style={{ background: t.color }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan override */}
            <div className={styles.editSection}>
              <div className={styles.editSectionTitle}>📋 Plan override</div>
              <div className={styles.field}>
                <label>Aktivan plan</label>
                <select
                  value={editForm.plan}
                  onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                >
                  <option value="starter">Starter (besplatan)</option>
                  <option value="pro">Pro (plaćen)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Pro ističe</label>
                <input
                  type="date"
                  value={editForm.plan_expires_at}
                  onChange={e => setEditForm(f => ({ ...f, plan_expires_at: e.target.value }))}
                />
                <div className={styles.fieldHint}>Ostavi prazno ako nema expiry datuma.</div>
              </div>
              <div className={styles.field}>
                <label>Trial ističe</label>
                <input
                  type="date"
                  value={editForm.trial_ends_at}
                  onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                />
              </div>
            </div>

            {/* Addon override — spans full width */}
            <div className={`${styles.editSection} ${styles.addonSection}`}>
              <div className={styles.editSectionTitle}>🧩 Addon moduli override</div>
              <div className={styles.fieldHint} style={{ marginBottom: 16 }}>
                Uključeni addoni bit će dostupni tenantu bez plaćanja, bez obzira na plan. Korisno za testiranje i beta pristup pojedinih modula.
              </div>

              {loadingEdit ? (
                <div className={styles.addonLoading}>Učitavanje...</div>
              ) : (
                <div className={styles.addonCategories}>
                  {Object.entries(catalogByCategory).map(([category, addons]) => (
                    <div key={category} className={styles.addonCategoryGroup}>
                      <div className={styles.addonCategoryLabel}>
                        {CATEGORY_LABELS[category] ?? category}
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
                              <span className={styles.addonTogglePrice}>€{addon.price_monthly}/mj</span>
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
            <button className={styles.btnCancel} onClick={closeEdit}>Odustani</button>
            <button className={styles.btnSave} onClick={saveEdit} disabled={saving}>
              {saving ? 'Čuvanje...' : 'Sačuvaj izmjene'}
            </button>
            {saveMsg && (
              <span className={saveMsg.startsWith('Greška') ? styles.msgError : styles.msgOk}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

function ThemeDot({ theme }) {
  const t = ADMIN_THEMES.find(x => x.key === (theme || 'green')) || ADMIN_THEMES[0]
  return (
    <span className={styles.themeDot} style={{ background: t.color }} title={`Tema: ${t.label}`} />
  )
}

function PlanBadge({ rest }) {
  if (rest.is_complimentary) {
    return <span className={`${styles.badge} ${styles.badgeComplimentary}`}>🎁 Complimentary</span>
  }
  if (rest.plan === 'pro') {
    return <span className={`${styles.badge} ${styles.badgePro}`}>Pro</span>
  }
  return <span className={`${styles.badge} ${styles.badgeStarter}`}>Starter</span>
}

function StatusBadge({ status }) {
  const map = {
    complimentary: { label: 'Aktivan',     cls: styles.statusActive },
    pro:           { label: 'Aktivan',     cls: styles.statusActive },
    trial:         { label: 'Trial',       cls: styles.statusTrial },
    expired:       { label: 'Istekao',     cls: styles.statusExpired },
    suspended:     { label: 'Suspendovan', cls: styles.statusSuspended },
    starter:       { label: 'Starter',     cls: styles.statusStarter },
  }
  const { label, cls } = map[status] || map.starter
  return <span className={`${styles.statusPill} ${cls}`}>{label}</span>
}
