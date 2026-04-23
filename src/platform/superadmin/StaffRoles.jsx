// ▶ Zamijeniti: src/platform/superadmin/StaffRoles.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'
import styles from './StaffRoles.module.css'

export default function StaffRoles() {
  const { restaurant } = usePlatform()

  const [roles, setRoles] = useState([])
  const [staffCount, setStaffCount] = useState({})
  const [loading, setLoading] = useState(true)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant])

  const loadData = async () => {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('staff').select('id, role_id').eq('restaurant_id', restaurant.id).eq('is_active', true),
    ])
    setRoles(r || [])
    const counts = {}
    ;(s || []).forEach(m => { if (m.role_id) counts[m.role_id] = (counts[m.role_id] || 0) + 1 })
    setStaffCount(counts)
    setLoading(false)
  }

  const openRoleForm = (role = null, template = null) => {
    if (role) { setRoleForm({ name: role.name, permissions: role.permissions || [] }); setEditRole(role) }
    else if (template) { setRoleForm({ name: template.name, permissions: template.permissions }); setEditRole(null) }
    else { setRoleForm({ name: '', permissions: [] }); setEditRole(null) }
    setShowRoleForm(true)
  }

  const togglePerm = (perm) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  const saveRole = async (e) => {
    e.preventDefault()
    setSaving(true)
    if (editRole) {
      await supabase.from('roles').update({ name: roleForm.name, permissions: roleForm.permissions }).eq('id', editRole.id)
    } else {
      await supabase.from('roles').insert({ restaurant_id: restaurant.id, name: roleForm.name, permissions: roleForm.permissions })
    }
    await loadData()
    setSaving(false)
    setShowRoleForm(false)
  }

  const deleteRole = async (id) => {
    const count = staffCount[id] || 0
    if (count > 0) {
      alert(`Ova rola je dodijeljena ${count} zaposleniku. Prvo promijenite rolu u HR → Zaposleni.`)
      return
    }
    if (!confirm('Obrisati ovu rolu?')) return
    await supabase.from('roles').delete().eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Role i permisije</div>
        <button className={styles.btnPrimary} onClick={() => openRoleForm()}>+ Nova rola</button>
      </div>

      {roles.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔑</div>
          <div className={styles.emptyTitle}>Nema definisanih rola</div>
          <div className={styles.emptyDesc}>
            Role definišu šta svaki zaposlenik može da vidi i radi u aplikaciji. Počnite od predloška ili kreirajte vlastitu rolu.
          </div>
          <div className={styles.templates}>
            {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
              <button key={key} className={styles.templateBtn} onClick={() => openRoleForm(null, tmpl)}>
                + {tmpl.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.roleGrid}>
            {roles.map(role => (
              <div key={role.id} className={styles.roleCard}>
                <div className={styles.roleCardHeader}>
                  <div className={styles.roleName}>{role.name}</div>
                  <div className={styles.roleActions}>
                    <button className={styles.actionBtn} onClick={() => openRoleForm(role)}>Uredi</button>
                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => deleteRole(role.id)}>Briši</button>
                  </div>
                </div>
                <div className={styles.rolePerms}>
                  {(role.permissions || []).slice(0, 6).map(p => (
                    <span key={p} className={styles.permPill}>{p}</span>
                  ))}
                  {(role.permissions || []).length > 6 && (
                    <span className={styles.permPillMore}>+{role.permissions.length - 6} još</span>
                  )}
                  {(role.permissions || []).length === 0 && (
                    <span className={styles.permPillNone}>Bez permisija</span>
                  )}
                </div>
                <div className={styles.roleFooter}>
                  <span className={styles.roleStaffCount}>
                    {staffCount[role.id] || 0} aktivnih zaposlenih
                  </span>
                </div>
              </div>
            ))}
            <button className={styles.addRoleCard} onClick={() => openRoleForm()}>
              <span className={styles.addRoleIcon}>+</span>
              <span>Nova rola</span>
            </button>
          </div>

          <div className={styles.templateRow}>
            <span className={styles.templateRowLabel}>Dodaj iz predloška:</span>
            {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
              <button key={key} className={styles.templateBtn} onClick={() => openRoleForm(null, tmpl)}>+ {tmpl.name}</button>
            ))}
          </div>
        </>
      )}

      {showRoleForm && (
        <div className={styles.overlay} onClick={() => setShowRoleForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editRole ? `Uredi: ${editRole.name}` : 'Nova rola'}</div>
              <button className={styles.modalClose} onClick={() => setShowRoleForm(false)}>✕</button>
            </div>
            <form onSubmit={saveRole}>
              <div className={styles.field}>
                <label>Naziv role *</label>
                <input value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Konobar, Kuhinja, Šef smjene..." required />
              </div>
              <div className={styles.permSection}>
                <div className={styles.permSectionTitle}>Permisije</div>
                <div className={styles.permSectionDesc}>Odaberite šta zaposlenik sa ovom rolom može da vidi i radi.</div>
                {Object.entries(PERMISSIONS).map(([moduleKey, module]) => (
                  <div key={moduleKey} className={styles.permModule}>
                    <div className={styles.permModuleLabel}>{module.icon} {module.label}</div>
                    <div className={styles.permList}>
                      {Object.entries(module.permissions).map(([permKey, perm]) => (
                        <label key={permKey} className={styles.permItem}>
                          <input type="checkbox" checked={roleForm.permissions.includes(permKey)} onChange={() => togglePerm(permKey)} />
                          <div>
                            <div className={styles.permLabel}>{perm.label}</div>
                            <div className={styles.permDesc}>{perm.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.permCount}>Odabrano: {roleForm.permissions.length} permisija</div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowRoleForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj rolu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
