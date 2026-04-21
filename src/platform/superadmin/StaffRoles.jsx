// ▶ Zamijeniti: src/platform/superadmin/StaffRoles.jsx

import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'
import styles from './StaffRoles.module.css'

export default function StaffRoles() {
  const { restaurant } = usePlatform()
  const location = useLocation()

  const [roles, setRoles] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(
    location.pathname.includes('/roles') ? 'roles' : 'staff'
  )

  // Forma za dodavanje/editovanje zaposlenika
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [addMethod, setAddMethod] = useState('create') // 'create' | 'link'
  const [addForm, setAddForm] = useState({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  // Inline edit plate
  const [editingWage, setEditingWage] = useState(null)
  const [wageForm, setWageForm] = useState({ wage_type: 'monthly', wage_amount: '' })

  // Forma za role
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', permissions: [] })
  const [roleSaving, setRoleSaving] = useState(false)

  useEffect(() => {
    setActiveTab(location.pathname.includes('/roles') ? 'roles' : 'staff')
  }, [location.pathname])

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

  // ── Dodavanje zaposlenika ─────────────────────────────────
  const openStaffForm = (s = null) => {
    if (s) {
      setEditStaff(s)
      setAddForm({ email: s.email, role_id: s.role_id || '', wage_type: s.wage_type || 'monthly', wage_amount: s.wage_amount || '', password: '' })
    } else {
      setEditStaff(null)
      setAddForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
      setAddMethod('create')
    }
    setAddError('')
    setAddSuccess('')
    setShowAddStaff(true)
  }

  const addStaff = async (e) => {
    e.preventDefault()
    setAddSaving(true)
    setAddError('')
    setAddSuccess('')

    // Edit postojećeg
    if (editStaff) {
      await supabase.from('staff').update({
        role_id: addForm.role_id || null,
        wage_type: addForm.wage_type,
        wage_amount: parseFloat(addForm.wage_amount) || 0,
      }).eq('id', editStaff.id)
      setStaff(prev => prev.map(s => s.id === editStaff.id
        ? { ...s, role_id: addForm.role_id || null, role: roles.find(r => r.id === addForm.role_id), wage_type: addForm.wage_type, wage_amount: parseFloat(addForm.wage_amount) || 0 }
        : s
      ))
      setAddSaving(false)
      setShowAddStaff(false)
      setEditStaff(null)
      return
    }

    const email = addForm.email.trim().toLowerCase()

    // Provjeri da li zaposlenik već postoji
    const exists = staff.find(s => s.email.toLowerCase() === email)
    if (exists) {
      setAddError('Zaposlenik sa ovom email adresom već postoji.')
      setAddSaving(false)
      return
    }

    // Nađi user_id po emailu iz auth (samo ako postoji nalog)
    const { data: authUsers } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    // Pokušaj naći korisnika po emailu kroz restaurants tabelu
    const { data: existingUser } = await supabase
      .from('restaurants')
      .select('user_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    // Metoda: kreiraj nalog sa lozinkom
    if (addMethod === 'create') {
      if (!addForm.password || addForm.password.length < 6) {
        setAddError('Lozinka mora imati najmanje 6 karaktera.')
        setAddSaving(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          password: addForm.password,
          restaurant_id: restaurant.id,
          role_id: addForm.role_id || null,
          wage_type: addForm.wage_type,
          wage_amount: parseFloat(addForm.wage_amount) || 0,
        }),
      })
      const result = await resp.json()
      if (!resp.ok || result.error) {
        setAddError(result.error || 'Greška pri kreiranju naloga.')
        setAddSaving(false)
        return
      }
      await loadData()
      setAddSuccess(result.message)
      setAddForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
      setAddSaving(false)
      setTimeout(() => { setShowAddStaff(false); setAddSuccess('') }, 2500)
      return
    }

    // Metoda: pošalji link (dodaj u staff bez user_id)
    const { data, error } = await supabase.from('staff').insert({
      restaurant_id: restaurant.id,
      email,
      role_id: addForm.role_id || null,
      wage_type: addForm.wage_type,
      wage_amount: parseFloat(addForm.wage_amount) || 0,
      is_active: true,
      user_id: null,
    }).select('*, role:roles(name)').single()

    if (error) {
      setAddError('Greška pri dodavanju. Pokušajte ponovo.')
      setAddSaving(false)
      return
    }

    setStaff(prev => [...prev, data])
    setAddSuccess(`${email} je dodan kao zaposlenik.`)
    setAddForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '' })
    setAddSaving(false)

    // Zatvori formu nakon 2 sekunde
    setTimeout(() => {
      setShowAddStaff(false)
      setAddSuccess('')
    }, 2000)
  }

  // ── Plata ─────────────────────────────────────────────────
  const saveWage = async (staffId) => {
    await supabase.from('staff')
      .update({ wage_type: wageForm.wage_type, wage_amount: parseFloat(wageForm.wage_amount) || 0 })
      .eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId
      ? { ...s, wage_type: wageForm.wage_type, wage_amount: parseFloat(wageForm.wage_amount) || 0 }
      : s
    ))
    setEditingWage(null)
  }

  // ── Promjena role ─────────────────────────────────────────
  const changeRole = async (staffId, roleId) => {
    await supabase.from('staff').update({ role_id: roleId || null }).eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId
      ? { ...s, role_id: roleId || null, role: roles.find(r => r.id === roleId) }
      : s
    ))
  }

  // ── Aktivacija/deaktivacija ───────────────────────────────
  const toggleActive = async (staffId, current) => {
    await supabase.from('staff').update({ is_active: !current }).eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, is_active: !current } : s))
  }

  // ── Brisanje ──────────────────────────────────────────────
  const removeStaff = async (staffId, email) => {
    if (!confirm(`Ukloniti ${email} iz osoblja?`)) return
    await supabase.from('staff').delete().eq('id', staffId)
    setStaff(prev => prev.filter(s => s.id !== staffId))
  }

  // ── Role ─────────────────────────────────────────────────
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
        : [...f.permissions, perm],
    }))
  }

  const saveRole = async (e) => {
    e.preventDefault()
    setRoleSaving(true)
    if (editRole) {
      await supabase.from('roles').update({ name: roleForm.name, permissions: roleForm.permissions }).eq('id', editRole.id)
    } else {
      await supabase.from('roles').insert({ restaurant_id: restaurant.id, name: roleForm.name, permissions: roleForm.permissions })
    }
    await loadData()
    setRoleSaving(false)
    setShowRoleForm(false)
  }

  const deleteRole = async (id) => {
    if (!confirm('Obrisati ovu rolu? Zaposlenici sa ovom rolom ostaju bez role.')) return
    await supabase.from('roles').delete().eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  const activeStaff = staff.filter(s => s.is_active)
  const inactiveStaff = staff.filter(s => !s.is_active)

  return (
    <div className={styles.wrap}>

      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Osoblje i role</div>
        <div className={styles.topbarActions}>
          {activeTab === 'roles' && (
            <button className={styles.btnSecondary} onClick={() => openRoleForm()}>+ Nova rola</button>
          )}
          {activeTab === 'staff' && (
            <button className={styles.btnPrimary} onClick={() => openStaffForm()}>
              + Dodaj zaposlenika
            </button>
          )}
        </div>
      </div>

      {/* Tabovi */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'staff' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          Zaposleni ({staff.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'roles' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Role ({roles.length})
        </button>
      </div>

      {/* ── TAB: ZAPOSLENI ── */}
      {activeTab === 'staff' && (
        <div>
          {staff.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👤</div>
              <div className={styles.emptyTitle}>Nema zaposlenih</div>
              <div className={styles.emptyDesc}>Dodajte zaposlenike da biste upravljali pristupom i pratili troškove rada.</div>
              <button className={styles.btnPrimary} onClick={() => openStaffForm()}>
                + Dodaj prvog zaposlenika
              </button>
            </div>
          ) : (
            <div className={styles.staffList}>

              {/* Aktivni */}
              {activeStaff.length > 0 && (
                <>
                  <div className={styles.staffGroupTitle}>Aktivni ({activeStaff.length})</div>
                  {activeStaff.map(s => (
                    <div key={s.id} className={styles.staffCard}>
                      <div className={styles.staffCardMain}>
                        <div className={styles.staffAvatar}>
                          {s.email[0].toUpperCase()}
                        </div>
                        <div className={styles.staffInfo}>
                          <div className={styles.staffEmail}>{s.email}</div>
                          <div className={styles.staffMeta}>
                            <span className={styles.staffRole}>{s.role?.name || 'Bez role'}</span>
                            {s.wage_amount > 0 && (
                              <span className={styles.staffWage}>
                                €{parseFloat(s.wage_amount).toFixed(2)}/{s.wage_type === 'hourly' ? 'h' : s.wage_type === 'weekly' ? 'sed.' : 'mj.'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.staffCardActions}>
                        {/* Promjena role */}
                        <select
                          className={styles.roleSelect}
                          value={s.role_id || ''}
                          onChange={e => changeRole(s.id, e.target.value)}
                        >
                          <option value="">— Bez role —</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>

                        {/* Plata — inline edit */}
                        {editingWage === s.id ? (
                          <div className={styles.wageEdit}>
                            <select
                              value={wageForm.wage_type}
                              onChange={e => setWageForm(f => ({ ...f, wage_type: e.target.value }))}
                              className={styles.wageSelect}
                            >
                              <option value="hourly">Po satu</option>
                              <option value="weekly">Sedmično</option>
                              <option value="monthly">Mjesečno</option>
                            </select>
                            <input
                              type="number" min="0" step="0.01"
                              value={wageForm.wage_amount}
                              onChange={e => setWageForm(f => ({ ...f, wage_amount: e.target.value }))}
                              className={styles.wageInput}
                              placeholder="€"
                              autoFocus
                            />
                            <button className={styles.wageSave} onClick={() => saveWage(s.id)}>✓</button>
                            <button className={styles.wageCancel} onClick={() => setEditingWage(null)}>✕</button>
                          </div>
                        ) : (
                          <button
                            className={styles.wageBtn}
                            onClick={() => {
                              setEditingWage(s.id)
                              setWageForm({ wage_type: s.wage_type || 'monthly', wage_amount: s.wage_amount || '' })
                            }}
                          >
                            {s.wage_amount > 0
                              ? `€${parseFloat(s.wage_amount).toFixed(2)}/${s.wage_type === 'hourly' ? 'h' : s.wage_type === 'weekly' ? 'sed.' : 'mj.'}`
                              : '+ Plata'
                            }
                          </button>
                        )}

                        <button
                          className={styles.actionBtn}
                          onClick={() => openStaffForm(s)}
                        >
                          Uredi
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
                          onClick={() => toggleActive(s.id, s.is_active)}
                        >
                          Deaktiviraj
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => removeStaff(s.id, s.email)}
                        >
                          Ukloni
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Neaktivni */}
              {inactiveStaff.length > 0 && (
                <>
                  <div className={`${styles.staffGroupTitle} ${styles.staffGroupInactive}`}>
                    Neaktivni ({inactiveStaff.length})
                  </div>
                  {inactiveStaff.map(s => (
                    <div key={s.id} className={`${styles.staffCard} ${styles.staffCardInactive}`}>
                      <div className={styles.staffCardMain}>
                        <div className={`${styles.staffAvatar} ${styles.staffAvatarInactive}`}>
                          {s.email[0].toUpperCase()}
                        </div>
                        <div className={styles.staffInfo}>
                          <div className={styles.staffEmail}>{s.email}</div>
                          <div className={styles.staffMeta}>
                            <span className={styles.staffRole}>{s.role?.name || 'Bez role'}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.staffCardActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                          onClick={() => toggleActive(s.id, s.is_active)}
                        >
                          Aktiviraj
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => removeStaff(s.id, s.email)}
                        >
                          Ukloni
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ROLE ── */}
      {activeTab === 'roles' && (
        <div>
          {roles.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔑</div>
              <div className={styles.emptyTitle}>Nema definisanih rola</div>
              <div className={styles.emptyDesc}>Počnite od predloška ili kreirajte vlastitu rolu</div>
              <div className={styles.templates}>
                {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
                  <button key={key} className={styles.templateBtn} onClick={() => openRoleForm(null, tmpl)}>
                    + {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
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

          {/* Predlošci kad ima rola */}
          {roles.length > 0 && (
            <div className={styles.templateRow}>
              <span className={styles.templateRowLabel}>Dodaj iz predloška:</span>
              {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
                <button key={key} className={styles.templateBtn} onClick={() => openRoleForm(null, tmpl)}>
                  + {tmpl.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Dodaj zaposlenika ── */}
      {showAddStaff && (
        <div className={styles.overlay} onClick={() => { setShowAddStaff(false); setAddError(''); setAddSuccess(''); setEditStaff(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editStaff ? 'Uredi zaposlenika' : 'Dodaj zaposlenika'}</div>
              <button className={styles.modalClose} onClick={() => { setShowAddStaff(false); setAddError(''); setAddSuccess('') }}>✕</button>
            </div>

            {addSuccess ? (
              <div className={styles.successMsg}>
                <div className={styles.successIcon}>✓</div>
                <div>{addSuccess}</div>
              </div>
            ) : (
              <form onSubmit={addStaff} className={styles.addForm}>
                <div className={styles.field}>
                  <label>Email adresa *</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={e => !editStaff && setAddForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="zaposlenik@email.com"
                    required
                    autoFocus
                    readOnly={!!editStaff}
                    style={editStaff ? { background: '#f8faf9', color: '#8a9e96' } : {}}
                  />
                  <div className={styles.fieldHint}>
                    Zaposlenik treba da kreira nalog na SmartMeni sa ovim emailom da bi dobio pristup.
                  </div>
                  {!editStaff && (
                  <div className={styles.methodToggle}>
                    <button type="button"
                      className={`${styles.methodBtn} ${addMethod === 'create' ? styles.methodBtnActive : ''}`}
                      onClick={() => setAddMethod('create')}>
                      🔑 Kreiraj nalog odmah
                    </button>
                    <button type="button"
                      className={`${styles.methodBtn} ${addMethod === 'link' ? styles.methodBtnActive : ''}`}
                      onClick={() => setAddMethod('link')}>
                      🔗 Pošalji link za registraciju
                    </button>
                  </div>
                )}
                {!editStaff && addMethod === 'create' && (
                  <div className={styles.field}>
                    <label>Privremena lozinka *</label>
                    <input
                      type="password"
                      value={addForm.password}
                      onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Minimum 6 karaktera"
                    />
                    <div className={styles.fieldHint}>Zaposlenik se može odmah ulogovati i promijeniti lozinku u Moj nalog.</div>
                  </div>
                )}
                {!editStaff && addMethod === 'link' && (
                  <div className={styles.registerLinkBox}>
                    <span className={styles.registerLinkLabel}>Link za registraciju:</span>
                    <span className={styles.registerLinkUrl}>{window.location.origin}/registracija</span>
                    <button type="button" className={styles.registerLinkCopy}
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/registracija`); alert('Link kopiran!') }}>
                      Kopiraj
                    </button>
                  </div>
                )}
                </div>

                <div className={styles.field}>
                  <label>Rola</label>
                  <select
                    value={addForm.role_id}
                    onChange={e => setAddForm(f => ({ ...f, role_id: e.target.value }))}
                  >
                    <option value="">— Bez role (dodijeli kasnije) —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {roles.length === 0 && (
                    <div className={styles.fieldHintWarn}>
                      ⚠️ Nemate definisane role. Prvo kreirajte role u tabu Role, pa dodijelite zaposleniku.
                    </div>
                  )}
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Tip plate</label>
                    <select
                      value={addForm.wage_type}
                      onChange={e => setAddForm(f => ({ ...f, wage_type: e.target.value }))}
                    >
                      <option value="hourly">Po satu</option>
                      <option value="weekly">Sedmično</option>
                      <option value="monthly">Mjesečno</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Iznos plate (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={addForm.wage_amount}
                      onChange={e => setAddForm(f => ({ ...f, wage_amount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {addError && <div className={styles.errorMsg}>{addError}</div>}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => { setShowAddStaff(false); setAddError('') }}>
                    Odustani
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={addSaving}>
                    {addSaving ? 'Čuvanje...' : editStaff ? 'Sačuvaj izmjene' : 'Dodaj zaposlenika'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Role forma ── */}
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
                  onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
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
                <button type="button" className={styles.btnSecondary} onClick={() => setShowRoleForm(false)}>
                  Odustani
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={roleSaving}>
                  {roleSaving ? 'Čuvanje...' : 'Sačuvaj rolu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
