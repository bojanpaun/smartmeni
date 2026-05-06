// ▶ Zamijeniti: src/modules/hr/pages/StaffPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './StaffPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

export default function StaffPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [addMethod, setAddMethod] = useState('create')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [form, setForm] = useState({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })

  useEffect(() => { if (restaurant) loadData() }, [restaurant])

  const loadData = async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const [{ data: s }, { data: r }, { data: att }] = await Promise.all([
      supabase.from('staff').select('*, role:roles(name)').eq('restaurant_id', restaurant.id).order('created_at'),
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('attendance_entries').select('staff_id, clock_in, clock_out').eq('restaurant_id', restaurant.id).eq('date', todayStr),
    ])
    const presentIds = new Set((att || []).filter(a => a.clock_in && !a.clock_out).map(a => a.staff_id))
    setStaff((s || []).map(st => ({ ...st, _present: presentIds.has(st.id) })))
    setRoles(r || [])
    setLoading(false)
  }

  const openForm = () => {
    setForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
    setAddMethod('create'); setAddError(''); setAddSuccess(''); setShowForm(true)
  }

  const saveStaff = async (e) => {
    e.preventDefault(); setSaving(true); setAddError('')
    const email = form.email.trim().toLowerCase()
    if (staff.find(s => s.email.toLowerCase() === email)) {
      setAddError('Zaposlenik sa ovim emailom već postoji.'); setSaving(false); return
    }
    if (addMethod === 'create') {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: { email, password: form.password, restaurant_id: restaurant.id, role_id: form.role_id || null }
      })
      if (error || data?.error) { setAddError(data?.error || 'Greška pri kreiranju.'); setSaving(false); return }
    }
    const { data: newStaff } = await supabase.from('staff').insert({
      restaurant_id: restaurant.id, email, role_id: form.role_id || null,
      wage_type: form.wage_type, wage_amount: parseFloat(form.wage_amount) || 0,
      is_active: true, start_date: new Date().toISOString().split('T')[0],
    }).select('*, role:roles(name)').single()
    if (newStaff) {
      setStaff(prev => [...prev, newStaff])
      await supabase.from('staff_history').insert({
        staff_id: newStaff.id, restaurant_id: restaurant.id,
        event_type: 'hired', description: 'Zaposlenik dodan u sistem',
        event_date: new Date().toISOString().split('T')[0],
      })
    }
    setSaving(false); setAddSuccess('Zaposlenik dodan!')
    setTimeout(() => { setShowForm(false); setAddSuccess('') }, 1500)
  }

  const toggleActive = async (e, s) => {
    e.stopPropagation()
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
  }

  const removeStaff = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Ukloniti zaposlenika?')) return
    await supabase.from('staff').delete().eq('id', id)
    setStaff(prev => prev.filter(x => x.id !== id))
  }

  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className={gsStyles.title}>Zaposleni</h1>
          <p className={gsStyles.subtitle}>Pregled i upravljanje zaposlenicima.</p>
        </div>
        <button className={styles.btnPrimary} onClick={openForm}>+ Dodaj zaposlenika</button>
      </div>

      {staff.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>Nema zaposlenih</div>
          <div className={styles.emptyDesc}>Dodaj prvog zaposlenika da počneš koristiti HR modul</div>
          <button className={styles.btnPrimary} onClick={openForm}>+ Dodaj zaposlenika</button>
        </div>
      ) : (
        <div className={styles.content}>
          {active.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>AKTIVNI ({active.length})</div>
              <StaffTable
                staff={active}
                onEdit={(id) => navigate(`/admin/hr/staff/${id}`)}
                onToggle={toggleActive}
                onRemove={removeStaff}
              />
            </div>
          )}
          {inactive.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>NEAKTIVNI ({inactive.length})</div>
              <StaffTable
                staff={inactive}
                onEdit={(id) => navigate(`/admin/hr/staff/${id}`)}
                onToggle={toggleActive}
                onRemove={removeStaff}
              />
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Dodaj zaposlenika</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.methodToggle}>
              <button className={`${styles.methodBtn} ${addMethod === 'create' ? styles.methodActive : ''}`} onClick={() => setAddMethod('create')}>Kreiraj nalog</button>
              <button className={`${styles.methodBtn} ${addMethod === 'invite' ? styles.methodActive : ''}`} onClick={() => setAddMethod('invite')}>Pošalji pozivnicu</button>
            </div>
            <form onSubmit={saveStaff}>
              <div className={styles.field}><label>Email adresa *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              {addMethod === 'create' && <div className={styles.field}><label>Lozinka *</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} /></div>}
              <div className={styles.field}><label>Rola</label><select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}><option value="">— Bez role —</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className={styles.fieldRow}>
                <div className={styles.field}><label>Tip plate</label><select value={form.wage_type} onChange={e => setForm(f => ({ ...f, wage_type: e.target.value }))}><option value="monthly">Mjesečna</option><option value="weekly">Sedmična</option><option value="hourly">Po satu</option></select></div>
                <div className={styles.field}><label>Iznos (€)</label><input type="number" min="0" step="0.01" value={form.wage_amount} onChange={e => setForm(f => ({ ...f, wage_amount: e.target.value }))} placeholder="0.00" /></div>
              </div>
              {addError && <div className={styles.error}>{addError}</div>}
              {addSuccess && <div className={styles.success}>✓ {addSuccess}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Dodavanje...' : 'Dodaj zaposlenika'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StaffTable({ staff, onEdit, onToggle, onRemove }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Zaposlenik</th>
            <th>Rola</th>
            <th>Danas</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Akcije</th>
          </tr>
        </thead>
        <tbody>
          {staff.map(s => {
            const initials = s.first_name && s.last_name
              ? `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
              : s.email[0].toUpperCase()
            const displayName = s.first_name && s.last_name
              ? `${s.first_name} ${s.last_name}`
              : s.email
            const wage = s.wage_amount > 0
              ? `€${parseFloat(s.wage_amount).toFixed(0)}/${s.wage_type === 'hourly' ? 'h' : s.wage_type === 'weekly' ? 'sed.' : 'mj.'}`
              : '—'

            return (
              <tr key={s.id} className={styles.tableRow} onClick={() => onEdit(s.id)}>
                <td>
                  <div className={styles.nameCell}>
                    <div className={styles.avatar}>{s.avatar_url ? <img src={s.avatar_url} alt={displayName} /> : initials}</div>
                    <div>
                      <div className={styles.staffName}>{displayName}</div>
                      {s.first_name && <div className={styles.staffEmail}>{s.email}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  {s.role?.name
                    ? <span className={styles.roleBadge}>{s.role.name}</span>
                    : <span className={styles.noRole}>—</span>
                  }
                </td>
                <td>
                  {s._present
                    ? <span className={styles.connectedBadge}>Na poslu</span>
                    : <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #8a9e96)' }}>—</span>
                  }
                </td>
                <td>
                  {s.user_id
                    ? <span className={styles.connectedBadge}>Povezan</span>
                    : <span className={styles.pendingBadge}>Čeka registraciju</span>
                  }
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit} onClick={() => onEdit(s.id)}>Uredi</button>
                    <button className={`${styles.btnAction} ${s.is_active ? styles.btnWarn : styles.btnOk}`} onClick={e => onToggle(e, s)}>
                      {s.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={e => onRemove(e, s.id)}>Ukloni</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
