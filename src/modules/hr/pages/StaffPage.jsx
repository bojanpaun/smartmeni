// ▶ Zamijeniti: src/modules/hr/pages/StaffPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import { logAudit } from '../../../lib/auditLog'
import { useSortable } from '../../../hooks/useSortable'
import SortableHead from '../../../components/shared/SortableHead'
import styles from './StaffPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

export default function StaffPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
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

  // Obavijesti
  const [announcements, setAnnouncements] = useState([])
  const [showAnnForm, setShowAnnForm]     = useState(false)
  const [annForm, setAnnForm]             = useState({ title: '', body: '', expires_at: '' })
  const [editingAnnId, setEditingAnnId]   = useState(null)
  const [annSaving, setAnnSaving]         = useState(false)

  useEffect(() => { if (restaurant) loadData() }, [restaurant])

  const loadData = async () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const [{ data: s }, { data: r }, { data: att }, { data: pendingAbs }, { data: anns }] = await Promise.all([
      supabase.from('staff').select('*, role:roles!role_id(name)').eq('restaurant_id', restaurant.id).order('created_at'),
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('attendance_entries').select('staff_id, clock_in, clock_out').eq('restaurant_id', restaurant.id).eq('date', todayStr),
      supabase.from('staff_absences').select('staff_id').eq('restaurant_id', restaurant.id).is('approved', null),
      supabase.from('staff_announcements').select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }),
    ])
    const presentIds = new Set((att || []).filter(a => a.clock_in && !a.clock_out).map(a => a.staff_id))
    const pendingCounts = (pendingAbs || []).reduce((acc, a) => {
      acc[a.staff_id] = (acc[a.staff_id] || 0) + 1; return acc
    }, {})
    setStaff((s || []).map(st => ({ ...st, _present: presentIds.has(st.id), _pendingAbsences: pendingCounts[st.id] || 0 })))
    setRoles(r || [])
    setAnnouncements(anns || [])
    setLoading(false)
  }

  const saveAnnouncement = async (e) => {
    e.preventDefault()
    setAnnSaving(true)
    const payload = { title: annForm.title, body: annForm.body || null, expires_at: annForm.expires_at || null }
    if (editingAnnId) {
      const { data } = await supabase.from('staff_announcements')
        .update({ ...payload, edited_at: new Date().toISOString() }).eq('id', editingAnnId).select().single()
      if (data) setAnnouncements(prev => prev.map(a => a.id === editingAnnId ? data : a))
    } else {
      const { data } = await supabase.from('staff_announcements')
        .insert({ restaurant_id: restaurant.id, ...payload }).select().single()
      if (data) setAnnouncements(prev => [data, ...prev])
    }
    setAnnForm({ title: '', body: '', expires_at: '' })
    setEditingAnnId(null)
    setShowAnnForm(false)
    setAnnSaving(false)
  }

  const openEditAnn = (a) => {
    setEditingAnnId(a.id)
    setAnnForm({ title: a.title, body: a.body || '', expires_at: a.expires_at ? a.expires_at.slice(0, 10) : '' })
    setShowAnnForm(true)
  }

  const deleteAnnouncement = async (id) => {
    await supabase.from('staff_announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  const openForm = () => {
    setForm({ email: '', role_id: '', wage_type: 'monthly', wage_amount: '', password: '' })
    setAddMethod('create'); setAddError(''); setAddSuccess(''); setShowForm(true)
  }

  const saveStaff = async (e) => {
    e.preventDefault(); setSaving(true); setAddError('')
    const email = form.email.trim().toLowerCase()
    if (staff.find(s => s.email.toLowerCase() === email)) {
      setAddError(t('stfEmailExists')); setSaving(false); return
    }

    // Edge funkcija kreira Auth nalog + staff zapis (service_role, bypassuje RLS)
    const { data, error } = await supabase.functions.invoke('create-staff-user', {
      body: {
        email,
        password: addMethod === 'create' ? form.password : undefined,
        restaurant_id: restaurant.id,
        role_id: form.role_id || null,
        wage_type: form.wage_type,
        wage_amount: form.wage_amount,
        action: addMethod,
      }
    })
    if (error || data?.error) {
      let msg = data?.error
      if (!msg && error) {
        try { const b = await error.context?.json(); msg = b?.error } catch {}
        msg = msg || error.message || t('stfCreateErr')
      }
      setAddError(msg); setSaving(false); return
    }

    // Edge funkcija vraća kreiran staff zapis — dodaj u lokalni state
    if (data?.staff) {
      setStaff(prev => [...prev, data.staff])
    }
    logAudit({
      restaurantId: restaurant.id, action: 'staff.created',
      entityType: 'staff', entityId: data?.staff?.id ?? null,
      summary: `${addMethod === 'invite' ? 'Pozvan' : 'Dodat'} član osoblja ${email}`,
      metadata: { method: addMethod },
    })
    setSaving(false)
    setAddSuccess(addMethod === 'invite' ? t('stfInviteSent') : t('stfStaffAdded'))
    setTimeout(() => { setShowForm(false); setAddSuccess('') }, 1500)
  }

  const toggleActive = async (e, s) => {
    e.stopPropagation()
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
    logAudit({
      restaurantId: restaurant.id,
      action: s.is_active ? 'staff.deactivated' : 'staff.activated',
      entityType: 'staff', entityId: s.id,
      summary: `${s.is_active ? 'Deaktiviran' : 'Aktiviran'} član osoblja ${s.email}`,
    })
    setStaff(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
  }

  const removeStaff = async (e, id) => {
    e.stopPropagation()
    if (!confirm(t('stfRemoveConfirm'))) return
    await supabase.from('staff').delete().eq('id', id)
    logAudit({
      restaurantId: restaurant.id, action: 'staff.deleted',
      entityType: 'staff', entityId: id, summary: 'Obrisan član osoblja',
    })
    setStaff(prev => prev.filter(x => x.id !== id))
  }

  const active = staff.filter(s => s.is_active)
  const inactive = staff.filter(s => !s.is_active)

  if (loading) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className={gsStyles.title}>{t('stfTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('stfSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openForm}>+ {t('stfAddStaff')}</button>
      </div>

      {staff.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👤</div>
          <div className={styles.emptyTitle}>{t('stfNoStaff')}</div>
          <div className={styles.emptyDesc}>{t('stfNoStaffDesc')}</div>
          <button className={styles.btnPrimary} onClick={openForm}>+ {t('stfAddStaff')}</button>
        </div>
      ) : (
        <div className={styles.content}>
          {active.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>{t('stfActiveN', { n: active.length })}</div>
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
              <div className={styles.sectionLabel}>{t('stfInactiveN', { n: inactive.length })}</div>
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

      {/* Obavijesti za osoblje preseljene u Obavještenja (/admin/notifications → tab Oglasna tabla) */}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{t('stfAddStaff')}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.methodToggle}>
              <button className={`${styles.methodBtn} ${addMethod === 'create' ? styles.methodActive : ''}`} onClick={() => setAddMethod('create')}>{t('stfCreateAccount')}</button>
              <button className={`${styles.methodBtn} ${addMethod === 'invite' ? styles.methodActive : ''}`} onClick={() => setAddMethod('invite')}>{t('stfSendInvite')}</button>
            </div>
            <form onSubmit={saveStaff}>
              <div className={styles.field}><label>{t('stfEmailLabel')} *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              {addMethod === 'create' && <div className={styles.field}><label>{t('stfPassword')} *</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} /></div>}
              <div className={styles.field}><label>{t('stfRole')}</label><select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}><option value="">{t('stfNoRole')}</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className={styles.fieldRow}>
                <div className={styles.field}><label>{t('stfWageType')}</label><select value={form.wage_type} onChange={e => setForm(f => ({ ...f, wage_type: e.target.value }))}><option value="monthly">{t('stfWageMonthly')}</option><option value="weekly">{t('stfWageWeekly')}</option><option value="hourly">{t('stfWageHourly')}</option></select></div>
                <div className={styles.field}><label>{t('stfAmountEur')}</label><input type="number" min="0" step="0.01" value={form.wage_amount} onChange={e => setForm(f => ({ ...f, wage_amount: e.target.value }))} placeholder="0.00" /></div>
              </div>
              {addError && <div className={styles.error}>{addError}</div>}
              {addSuccess && <div className={styles.success}>✓ {addSuccess}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? t('stfAdding') : t('stfAddStaff')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StaffTable({ staff, onEdit, onToggle, onRemove }) {
  const { t } = useTranslation('admin')
  const money = useMoney()
  const sort = useSortable('_displayName', 'asc')
  const staffWithNames = staff.map(s => ({
    ...s,
    _displayName: s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.email,
  }))

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th><SortableHead col="_displayName" label={t('stfStaffMember')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
            <th><SortableHead col="role.name"    label={t('stfRole')}       sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
            <th>{t('stfToday')}</th>
            <th><SortableHead col="is_active"    label={t('htFieldStatus')}     sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></th>
            <th style={{ textAlign: 'right' }}>{t('stfActions')}</th>
          </tr>
        </thead>
        <tbody>
          {sort.sort(staffWithNames).map(s => {
            const initials = s.first_name && s.last_name
              ? `${s.first_name[0]}${s.last_name[0]}`.toUpperCase()
              : s.email[0].toUpperCase()
            const displayName = s._displayName
            const wage = s.wage_amount > 0
              ? `${money(s.wage_amount)}/${s.wage_type === 'hourly' ? t('stfPerHour') : s.wage_type === 'weekly' ? t('stfPerWeek') : t('stfPerMonth')}`
              : '—'

            return (
              <tr key={s.id} className={styles.tableRow} onClick={() => onEdit(s.id)}>
                <td>
                  <div className={styles.nameCell}>
                    <div className={styles.avatar}>{s.avatar_url ? <img src={s.avatar_url} alt={displayName} /> : initials}</div>
                    <div>
                      <div className={styles.staffName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {displayName}
                        {s._pendingAbsences > 0 && (
                          <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>
                            {s._pendingAbsences === 1 ? t('stfReqOne', { n: s._pendingAbsences }) : t('stfReqOther', { n: s._pendingAbsences })}
                          </span>
                        )}
                      </div>
                      {s.first_name && <div className={styles.staffEmail}>{s.email}</div>}
                      <div className={styles.mobileInfo}>
                        {s.role?.name && <span className={styles.roleBadge}>{s.role.name}</span>}
                        {s._present && <span className={styles.connectedBadge}>{t('stfAtWork')}</span>}
                      </div>
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
                    ? <span className={styles.connectedBadge}>{t('stfAtWork')}</span>
                    : <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #8a9e96)' }}>—</span>
                  }
                </td>
                <td>
                  {s.user_id
                    ? <span className={styles.connectedBadge}>{t('stfConnected')}</span>
                    : <span className={styles.pendingBadge}>{t('stfPendingReg')}</span>
                  }
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit} onClick={() => onEdit(s.id)}>{t('htEdit')}</button>
                    <button className={`${styles.btnAction} ${s.is_active ? styles.btnWarn : styles.btnOk}`} onClick={e => onToggle(e, s)}>
                      {s.is_active ? t('psDeactivate') : t('psActivate')}
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={e => onRemove(e, s.id)}>{t('stfRemove')}</button>
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
