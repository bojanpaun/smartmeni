// ▶ Novi fajl: src/platform/superadmin/SuperAdminPanel.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { planStatus } from '../../lib/planUtils'
import styles from './SuperAdminPanel.module.css'

export default function SuperAdminPanel() {
  const { isSuperAdmin } = usePlatform()

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    is_complimentary: false,
    complimentary_note: '',
    plan: 'starter',
    plan_expires_at: '',
    trial_ends_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    loadRestaurants()
  }, [])

  const loadRestaurants = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, plan, trial_ends_at, plan_expires_at, suspended_at, is_complimentary, complimentary_note, created_at')
      .order('created_at', { ascending: false })

    if (!error) setRestaurants(data || [])
    setLoading(false)
  }

  const openEdit = (rest) => {
    setEditingId(rest.id)
    setEditForm({
      is_complimentary: rest.is_complimentary || false,
      complimentary_note: rest.complimentary_note || '',
      plan: rest.plan || 'starter',
      plan_expires_at: rest.plan_expires_at ? rest.plan_expires_at.slice(0, 10) : '',
      trial_ends_at: rest.trial_ends_at ? rest.trial_ends_at.slice(0, 10) : '',
    })
  }

  const closeEdit = () => {
    setEditingId(null)
    setSaveMsg('')
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
    }

    // Ako se dodjeljuje complimentary — automatski ukloni suspenziju
    if (editForm.is_complimentary) {
      payload.suspended_at = null
    }

    const { error } = await supabase
      .from('restaurants')
      .update(payload)
      .eq('id', editingId)

    if (!error) {
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

  // Filtriranje
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

  // Statistike
  const stats = {
    total: restaurants.length,
    pro: restaurants.filter(r => r.plan === 'pro' && !r.is_complimentary).length,
    complimentary: restaurants.filter(r => r.is_complimentary).length,
    suspended: restaurants.filter(r => !!r.suspended_at).length,
  }

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

      {/* Zaglavlje */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Super admin panel</div>
          <div className={styles.headerSub}>Upravljanje restoranima i planovima</div>
        </div>
        <button className={styles.btnRefresh} onClick={loadRestaurants}>↻ Osvježi</button>
      </div>

      {/* Statistike */}
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

      {/* Filteri i pretraga */}
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

      {/* Tabela restorana */}
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

      {/* Inline edit panel */}
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
