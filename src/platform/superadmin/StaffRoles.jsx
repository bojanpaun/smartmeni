import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'
import AdminLayout from '../../layouts/AdminLayout'
import styles from './StaffRoles.module.css'

export default function StaffRoles() {
  const { restaurant } = usePlatform()
  const [roles, setRoles] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('roles')
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant])

  const loadData = async () => {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('created_at'),
      supabase.from('staff').select('*, role:roles(name)').eq('restaurant_id', restaurant.id).order('created_at'),
    ])
    setRoles(r || [])
    setStaff(s || [])
    setLoading(false)
  }

  const openRoleForm = (role = null, template = null) => {
    if (role) {
      setRoleForm({ name: role.name, permissions: role.permissions || [] })
      setEditRole(role)
    } else if (template) {
      setRoleForm({ name: template.name, permissions: template.permissions })
      setEditRole(null)
    } else {
      setRoleForm({ name: '', permissions: [] })
      setEditRole(null)
    }
    setShowRoleForm(true)
  }

  const togglePerm = (perm) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm]
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
    if (!confirm('Obrisati ovu rolu?')) return
    await supabase.from('roles').delete().eq('id', id)
    setRoles(roles.filter(r => r.id !== id))
  }

  const inviteStaff = async () => {
    const email = prompt('Email adresa zaposlenika:')
    if (!email) return
    const roleId = roles.length > 0 ? prompt(`ID role (${roles.map(r => `${r.name}=${r.id.slice(0,8)}`).join(', ')}):`) : null

    await supabase.from('staff_invites').insert({
      restaurant_id: restaurant.id,
      email,
      role_id: roleId || null,
    })
    alert(`Pozivnica poslana na ${email}`)
  }

  if (loading) return <AdminLayout><div className={styles.loading}>Učitavanje...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Osoblje i role</div>
        <div className={styles.topbarActions}>
          <button className={styles.btnSecondary} onClick={() => openRoleForm()}>+ Nova rola</button>
          <button className={styles.btnPrimary} onClick={inviteStaff}>+ Pozovi zaposlenika</button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'roles' ? styles.tabActive : ''}`} onClick={() => setActiveTab('roles')}>
            Role ({roles.length})
          </button>
          <button className={`${styles.tab} ${activeTab === 'staff' ? styles.tabActive : ''}`} onClick={() => setActiveTab('staff')}>
            Osoblje ({staff.length})
          </button>
        </div>

        {/* ROLE TAB */}
        {activeTab === 'roles' && (
          <div>
            {roles.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <div className={styles.emptyTitle}>Nemate definisane role</div>
                <div className={styles.emptyDesc}>Počnite od predloška ili kreirajte vlastitu rolu</div>
                <div className={styles.templates}>
                  {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
                    <button key={key} className={styles.templateBtn} onClick={() => openRoleForm(null, tmpl)}>
                      + {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {roles.length > 0 && (
              <div className={styles.roleGrid}>
                {roles.map(role => (
                  <div key={role.id} className={styles.roleCard}>
                    <div className={styles.roleCardHeader}>
                      <div className={styles.roleName}>{role.name}</div>
                      <div className={styles.roleActions}>
                        <button className={styles.actionBtn} onClick={() => openRoleForm(role)}>Uredi</button>
                        <button className={styles.actionBtn} onClick={() => deleteRole(role.id)}>Briši</button>
                      </div>
                    </div>
                    <div className={styles.rolePerms}>
                      {(role.permissions || []).slice(0, 5).map(p => (
                        <span key={p} className={styles.permPill}>{p}</span>
                      ))}
                      {(role.permissions || []).length > 5 && (
                        <span className={styles.permPillMore}>+{role.permissions.length - 5}</span>
                      )}
                    </div>
                    <div className={styles.roleStaffCount}>
                      {staff.filter(s => s.role_id === role.id).length} zaposlenih
                    </div>
                  </div>
                ))}
                <button className={styles.addRoleCard} onClick={() => openRoleForm()}>
                  <span>+</span>
                  <span>Nova rola</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className={styles.card}>
            {staff.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👤</div>
                <div className={styles.emptyTitle}>Nema zaposlenih</div>
                <button className={styles.btnPrimary} onClick={inviteStaff}>Pozovi zaposlenika</button>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Zaposlenik</th>
                    <th>Rola</th>
                    <th>Status</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td><span className={styles.roleBadge}>{s.role?.name || '—'}</span></td>
                      <td><span className={`${styles.statusPill} ${s.is_active ? styles.statusActive : styles.statusInactive}`}>{s.is_active ? 'Aktivan' : 'Neaktivan'}</span></td>
                      <td>
                        <button className={styles.actionBtn}>Promijeni rolu</button>
                        <button className={styles.actionBtn}>Ukloni</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ROLE FORM MODAL */}
      {showRoleForm && (
        <div className={styles.overlay} onClick={() => setShowRoleForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editRole ? 'Uredi rolu' : 'Nova rola'}</div>
              <button className={styles.modalClose} onClick={() => setShowRoleForm(false)}>✕</button>
            </div>
            <form onSubmit={saveRole}>
              <div className={styles.field}>
                <label>Naziv role *</label>
                <input
                  value={roleForm.name}
                  onChange={e => setRoleForm(f => ({...f, name: e.target.value}))}
                  placeholder="npr. Konobar, Kuhinja, Šef smjene..."
                  required
                />
              </div>

              <div className={styles.permSection}>
                <div className={styles.permSectionTitle}>Permisije</div>
                {Object.entries(PERMISSIONS).map(([moduleKey, module]) => (
                  <div key={moduleKey} className={styles.permModule}>
                    <div className={styles.permModuleLabel}>{module.icon} {module.label}</div>
                    <div className={styles.permList}>
                      {Object.entries(module.permissions).map(([permKey, perm]) => (
                        <label key={permKey} className={styles.permItem}>
                          <input
                            type="checkbox"
                            checked={roleForm.permissions.includes(permKey)}
                            onChange={() => togglePerm(permKey)}
                          />
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

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowRoleForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj rolu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

