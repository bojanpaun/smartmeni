// ▶ Novi fajl: src/modules/hr/pages/StaffPage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './StaffPage.module.css'

export default function StaffPage() {
  const { restaurant, user } = usePlatform()

  const [staff, setStaff] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [addMethod, setAddMethod] = useState('create')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [editingWage, setEditingWage] = useState(null)
  const [wageForm, setWageForm] = useState({ wage_type: 'monthly', wage_amount: '' })

  const [form, setForm] = useState({
    email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '',
  })

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant])

  const loadData = async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from('staff').select('*, role:roles(name)')
        .eq('restaurant_id', restaurant.id).order('created_at'),
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
    ])
    setStaff(s || [])
    setRoles(r || [])
    setLoading(false)
  }

  const openForm = (s = null) => {
    if (s) {
      setEditStaff(s)
      setForm({ email: s.email, role_id: s.role_id || '', wage_type: s.wage_type || 'monthly', wage_amount: s.wage_amount || '', password: '' })
    } else {
      setEditStaff(null)
      setForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
      setAddMethod('create')
    }
    setAddError('')
    setAddSuccess('')
    setShowForm(true)
  }

  const saveStaff = async (e) => {
    e.preventDefault()
    setSaving(true)
    setAddError('')

    if (editStaff) {
      await supabase.from('staff').update({
        role_id: form.role_id || null,
        wage_type: form.wage_type,
        wage_amount: parseFloat(form.wage_amount) || 0,
      }).eq('id', editStaff.id)
      setStaff(prev => prev.map(s => s.id === editStaff.id
        ? { ...s, role_id: form.role_id || null, role: roles.find(r => r.id === form.role_id), wage_type: form.wage_type, wage_amount: parseFloat(form.wage_amount) || 0 }
        : s
      ))
      setSaving(false)
      setShowForm(false)
      return
    }

    const email = form.email.trim().toLowerCase()
    if (staff.find(s => s.email.toLowerCase() === email)) {
      setAddError('Zaposlenik sa ovim emailom već postoji.')
      setSaving(false)
      return
    }

    if (addMethod === 'create') {
      if (!form.password || form.password.length < 6) {
        setAddError('Lozinka mora imati najmanje 6 karaktera.')
        setSaving(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email, password: form.password, restaurant_id: restaurant.id, role_id: form.role_id || null, wage_type: form.wage_type, wage_amount: parseFloat(form.wage_amount) || 0 }),
      })
      const result = await resp.json()
      if (!resp.ok || result.error) { setAddError(result.error || 'Greška.'); setSaving(false); return }
      setAddSuccess(result.message)
      await loadData()
    } else {
      const { data } = await supabase.from('staff').insert({
        restaurant_id: restaurant.id, email, role_id: form.role_id || null,
        wage_type: form.wage_type, wage_amount: parseFloat(form.wage_amount) || 0,
        is_active: true, user_id: null,
      }).select('*, role:roles(name)').single()
      setStaff(prev => [...prev, data])
      setAddSuccess(`${email} dodan. Zaposleniku pošalji link za registraciju.`)
    }

    setSaving(false)
    setTimeout(() => { setShowForm(false); setAddSuccess('') }, 2500)
  }

  const saveWage = async (staffId) => {
    await supabase.from('staff').update({ wage_type: wageForm.wage_type, wage_amount: parseFloat(wageForm.wage_amount) || 0 }).eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, wage_type: wageForm.wage_type, wage_amount: parseFloat(wageForm.wage_amount) || 0 } : s))
    setEditingWage(null)
  }

  const changeRole = async (staffId, roleId) => {
    await supabase.from('staff').update({ role_id: roleId || null }).eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, role_id: roleId || null, role: roles.find(r => r.id === roleId) } : s))
  }

  const toggleActive = async (staffId, current) => {
    await supabase.from('staff').update({ is_active: !current }).eq('id', staffId)
    setStaff(prev => prev.map(s => s.id === staffId ? { ...s, is_active: !current } : s))
  }

  const removeStaff = async (staffId, email) => {
    if (!confirm(`Ukloniti ${email}?`)) return
    await supabase.from('staff').delete().eq('id', staffId)
    setStaff(prev => prev.filter(s => s.id !== staffId))
  }

  const staffName = (s) => s.user_profiles?.full_name || s.email.split('@')[0]
  const activeStaff = staff.filter(s => s.is_active)
  const inactiveStaff = staff.filter(s => !s.is_active)

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>Zaposleni</div>
        <button className={styles.btnAdd} onClick={() => openForm()}>+ Dodaj zaposlenika</button>
      </div>

      {staff.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>Nema zaposlenih</div>
          <div className={styles.emptyDesc}>Dodajte zaposlenike da biste upravljali rasporedima, dolascima i zaradama.</div>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ Dodaj prvog zaposlenika</button>
        </div>
      ) : (
        <div className={styles.staffList}>
          {activeStaff.length > 0 && (
            <>
              <div className={styles.groupTitle}>Aktivni ({activeStaff.length})</div>
              {activeStaff.map(s => (
                <div key={s.id} className={styles.staffCard}>
                  <div className={styles.staffMain}>
                    <div className={styles.avatar}>{staffName(s)[0].toUpperCase()}</div>
                    <div className={styles.staffInfo}>
                      <div className={styles.staffEmail}>{s.email}</div>
                      <div className={styles.staffMeta}>
                        <span className={styles.rolePill}>{s.role?.name || 'Bez role'}</span>
                        {s.wage_amount > 0 && (
                          <span className={styles.wagePill}>
                            €{parseFloat(s.wage_amount).toFixed(2)}/{s.wage_type === 'hourly' ? 'h' : s.wage_type === 'weekly' ? 'sed.' : 'mj.'}
                          </span>
                        )}
                        {s.user_id ? <span className={styles.connectedPill}>✓ Povezan</span> : <span className={styles.notConnectedPill}>Čeka registraciju</span>}
                      </div>
                    </div>
                  </div>
                  <div className={styles.staffActions}>
                    <select className={styles.roleSelect} value={s.role_id || ''} onChange={e => changeRole(s.id, e.target.value)}>
                      <option value="">— Bez role —</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    {editingWage === s.id ? (
                      <div className={styles.wageEdit}>
                        <select value={wageForm.wage_type} onChange={e => setWageForm(f => ({ ...f, wage_type: e.target.value }))} className={styles.wageSelect}>
                          <option value="hourly">Po satu</option>
                          <option value="weekly">Sedmično</option>
                          <option value="monthly">Mjesečno</option>
                        </select>
                        <input type="number" min="0" step="0.01" value={wageForm.wage_amount} onChange={e => setWageForm(f => ({ ...f, wage_amount: e.target.value }))} className={styles.wageInput} placeholder="€" autoFocus />
                        <button className={styles.wageSave} onClick={() => saveWage(s.id)}>✓</button>
                        <button className={styles.wageCancel} onClick={() => setEditingWage(null)}>✕</button>
                      </div>
                    ) : (
                      <button className={styles.wageBtn} onClick={() => { setEditingWage(s.id); setWageForm({ wage_type: s.wage_type || 'monthly', wage_amount: s.wage_amount || '' }) }}>
                        {s.wage_amount > 0 ? `€${parseFloat(s.wage_amount).toFixed(2)}/${s.wage_type === 'hourly' ? 'h' : s.wage_type === 'weekly' ? 'sed.' : 'mj.'}` : '+ Plata'}
                      </button>
                    )}
                    <button className={styles.btnEdit} onClick={() => openForm(s)}>Uredi</button>
                    <button className={`${styles.actionBtn} ${styles.btnWarn}`} onClick={() => toggleActive(s.id, s.is_active)}>Deaktiviraj</button>
                    <button className={`${styles.actionBtn} ${styles.btnDanger}`} onClick={() => removeStaff(s.id, s.email)}>Ukloni</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {inactiveStaff.length > 0 && (
            <>
              <div className={`${styles.groupTitle} ${styles.groupInactive}`}>Neaktivni ({inactiveStaff.length})</div>
              {inactiveStaff.map(s => (
                <div key={s.id} className={`${styles.staffCard} ${styles.staffCardInactive}`}>
                  <div className={styles.staffMain}>
                    <div className={`${styles.avatar} ${styles.avatarInactive}`}>{staffName(s)[0].toUpperCase()}</div>
                    <div className={styles.staffInfo}>
                      <div className={styles.staffEmail}>{s.email}</div>
                      <div className={styles.staffMeta}><span className={styles.rolePill}>{s.role?.name || 'Bez role'}</span></div>
                    </div>
                  </div>
                  <div className={styles.staffActions}>
                    <button className={`${styles.actionBtn} ${styles.btnSuccess}`} onClick={() => toggleActive(s.id, s.is_active)}>Aktiviraj</button>
                    <button className={`${styles.actionBtn} ${styles.btnDanger}`} onClick={() => removeStaff(s.id, s.email)}>Ukloni</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => { setShowForm(false); setEditStaff(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editStaff ? 'Uredi zaposlenika' : 'Dodaj zaposlenika'}</div>
              <button className={styles.modalClose} onClick={() => { setShowForm(false); setEditStaff(null) }}>✕</button>
            </div>

            {addSuccess ? (
              <div className={styles.successMsg}>
                <div className={styles.successIcon}>✓</div>
                <div>{addSuccess}</div>
              </div>
            ) : (
              <form onSubmit={saveStaff} className={styles.form}>
                <div className={styles.field}>
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={e => !editStaff && setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="zaposlenik@email.com" required readOnly={!!editStaff}
                    style={editStaff ? { background: '#f8faf9', color: '#8a9e96' } : {}} />
                </div>

                {!editStaff && (
                  <>
                    <div className={styles.methodToggle}>
                      <button type="button" className={`${styles.methodBtn} ${addMethod === 'create' ? styles.methodBtnActive : ''}`} onClick={() => setAddMethod('create')}>🔑 Kreiraj nalog odmah</button>
                      <button type="button" className={`${styles.methodBtn} ${addMethod === 'link' ? styles.methodBtnActive : ''}`} onClick={() => setAddMethod('link')}>🔗 Pošalji link</button>
                    </div>
                    {addMethod === 'create' && (
                      <div className={styles.field}>
                        <label>Privremena lozinka *</label>
                        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 karaktera" />
                        <div className={styles.hint}>Zaposlenik se može odmah ulogovati i promijeniti lozinku u Moj nalog.</div>
                      </div>
                    )}
                    {addMethod === 'link' && (
                      <div className={styles.linkBox}>
                        <span className={styles.linkLabel}>Link za registraciju:</span>
                        <span className={styles.linkUrl}>{window.location.origin}/registracija</span>
                        <button type="button" className={styles.linkCopy} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/registracija`); alert('Kopirano!') }}>Kopiraj</button>
                      </div>
                    )}
                  </>
                )}

                <div className={styles.field}>
                  <label>Rola</label>
                  <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
                    <option value="">— Bez role —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label>Tip plate</label>
                    <select value={form.wage_type} onChange={e => setForm(f => ({ ...f, wage_type: e.target.value }))}>
                      <option value="hourly">Po satu</option>
                      <option value="weekly">Sedmično</option>
                      <option value="monthly">Mjesečno</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Iznos (€)</label>
                    <input type="number" min="0" step="0.01" value={form.wage_amount} onChange={e => setForm(f => ({ ...f, wage_amount: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>

                {addError && <div className={styles.errorMsg}>{addError}</div>}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => { setShowForm(false); setEditStaff(null) }}>Odustani</button>
                  <button type="submit" className={styles.btnAdd} disabled={saving}>{saving ? 'Čuvanje...' : editStaff ? 'Sačuvaj' : 'Dodaj zaposlenika'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
