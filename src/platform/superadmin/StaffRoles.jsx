// ▶ Zamijeniti: src/platform/superadmin/StaffRoles.jsx

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'
import styles from './StaffRoles.module.css'

export default function StaffRoles() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')

  const [roles, setRoles] = useState([])
  const [staffCount, setStaffCount] = useState({})
  const [loading, setLoading] = useState(true)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [saving, setSaving] = useState(false)
  const [permTab, setPermTab] = useState(Object.keys(PERMISSIONS)[0])

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
    setPermTab(Object.keys(PERMISSIONS)[0])
    setShowRoleForm(true)
  }

  const selectAllInModule = (moduleKey) => {
    const modulePerms = Object.keys(PERMISSIONS[moduleKey].permissions)
    setRoleForm(f => ({
      ...f,
      permissions: [...new Set([...f.permissions, ...modulePerms])],
    }))
  }

  const clearAllInModule = (moduleKey) => {
    const modulePerms = Object.keys(PERMISSIONS[moduleKey].permissions)
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.filter(p => !modulePerms.includes(p)),
    }))
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
      alert(t('sroleAssignedAlert', { count }))
      return
    }
    if (!confirm(t('sroleDeleteConfirm'))) return
    await supabase.from('roles').delete().eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>{t('sroleTitle')}</div>
        <button className={styles.btnPrimary} onClick={() => openRoleForm()}>+ {t('sroleNewRole')}</button>
      </div>

      {roles.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔑</div>
          <div className={styles.emptyTitle}>{t('sroleNoneTitle')}</div>
          <div className={styles.emptyDesc}>
            {t('sroleNoneDesc')}
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
                    <button className={styles.actionBtn} onClick={() => openRoleForm(role)}>{t('htEdit')}</button>
                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => deleteRole(role.id)}>{t('invDelete')}</button>
                  </div>
                </div>
                <div className={styles.rolePerms}>
                  {(role.permissions || []).slice(0, 6).map(p => (
                    <span key={p} className={styles.permPill}>{p}</span>
                  ))}
                  {(role.permissions || []).length > 6 && (
                    <span className={styles.permPillMore}>+{role.permissions.length - 6} {t('sroleMore')}</span>
                  )}
                  {(role.permissions || []).length === 0 && (
                    <span className={styles.permPillNone}>{t('sroleNoPerms')}</span>
                  )}
                </div>
                <div className={styles.roleFooter}>
                  <span className={styles.roleStaffCount}>
                    {staffCount[role.id] || 0} {t('sroleActiveStaff')}
                  </span>
                </div>
              </div>
            ))}
            <button className={styles.addRoleCard} onClick={() => openRoleForm()}>
              <span className={styles.addRoleIcon}>+</span>
              <span>{t('sroleNewRole')}</span>
            </button>
          </div>

          <div className={styles.templateRow}>
            <span className={styles.templateRowLabel}>{t('sroleAddFromTemplate')}</span>
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
              <div className={styles.modalTitle}>{editRole ? t('saEditName', { name: editRole.name }) : t('sroleNewRole')}</div>
              <button className={styles.modalClose} onClick={() => setShowRoleForm(false)}>✕</button>
            </div>
            <form onSubmit={saveRole}>
              <div className={styles.field}>
                <label>{t('sroleRoleNameReq')}</label>
                <input value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder={t('sroleRoleNamePh')} required />
              </div>
              <div className={styles.permSection}>
                <div className={styles.permSectionTitle}>{t('srolePermissions')}</div>
                <div className={styles.permSectionDesc}>{t('srolePermDesc')}</div>

                {/* ── Horizontalna tab navigacija po modulu ── */}
                <div className={styles.permTabBar}>
                  {Object.entries(PERMISSIONS).map(([moduleKey, module]) => {
                    const modulePerms = Object.keys(module.permissions)
                    const selectedCount = roleForm.permissions.filter(p => modulePerms.includes(p)).length
                    return (
                      <button
                        key={moduleKey}
                        type="button"
                        className={`${styles.permTab} ${permTab === moduleKey ? styles.permTabActive : ''}`}
                        onClick={() => setPermTab(moduleKey)}
                      >
                        {module.icon} {module.label}
                        {selectedCount > 0 && (
                          <span style={{ marginLeft: 5, background: 'var(--c-primary)', color: '#fff',
                            borderRadius: '50%', fontSize: 10, fontWeight: 700,
                            padding: '1px 5px', verticalAlign: 'middle' }}>
                            {selectedCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* ── Aktivni modul panel ── */}
                {Object.entries(PERMISSIONS).map(([moduleKey, module]) => {
                  if (moduleKey !== permTab) return null
                  const modulePerms = Object.keys(module.permissions)
                  const allSelected = modulePerms.every(p => roleForm.permissions.includes(p))
                  const noneSelected = modulePerms.every(p => !roleForm.permissions.includes(p))
                  return (
                    <div key={moduleKey} className={styles.permModulePanel}>
                      <div className={styles.permModuleActions}>
                        <div className={styles.permModuleTitle}>{module.icon} {module.label}</div>
                        <button
                          type="button"
                          className={styles.permBulkBtn}
                          onClick={() => selectAllInModule(moduleKey)}
                          disabled={allSelected}
                        >
                          ✓ {t('sroleSelectAll')}
                        </button>
                        <button
                          type="button"
                          className={`${styles.permBulkBtn} ${styles.permBulkBtnClear}`}
                          onClick={() => clearAllInModule(moduleKey)}
                          disabled={noneSelected}
                        >
                          ✕ {t('sroleClearAll')}
                        </button>
                      </div>
                      <div className={styles.permList}>
                        {Object.entries(module.permissions).map(([permKey, perm]) => {
                          const checked = roleForm.permissions.includes(permKey)
                          return (
                            <label
                              key={permKey}
                              className={`${styles.permItem} ${checked ? styles.permItemChecked : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(permKey)}
                              />
                              <div>
                                <div className={styles.permLabel}>{perm.label}</div>
                                <div className={styles.permDesc}>{perm.desc}</div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className={styles.permCount}>
                {t('sroleTotalSelected', { count: roleForm.permissions.length })}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowRoleForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? t('saving') : t('sroleSaveRole')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
