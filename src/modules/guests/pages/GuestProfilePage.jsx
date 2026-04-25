// ▶ Novi fajl: src/modules/guests/pages/GuestProfilePage.jsx

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GuestProfilePage.module.css'

const STATUS_LABELS = { regular: 'Regular', vip: 'VIP', blacklist: 'Blacklist', pending: 'Na čekanju' }
const STATUS_STYLES = {
  regular: { background: '#f0f5f2', color: '#5a7a6a' },
  vip: { background: '#FAEEDA', color: '#633806' },
  blacklist: { background: '#FCEBEB', color: '#791F1F' },
  pending: { background: '#E6F1FB', color: '#0C447C' },
}
const VISIT_STATUS = {
  completed: { label: 'Završena', bg: '#E1F5EE', color: '#085041' },
  cancelled: { label: 'Otkazana', bg: '#f0f5f2', color: '#5a7a6a' },
  no_show: { label: 'No-show', bg: '#FCEBEB', color: '#791F1F' },
  unpaid: { label: 'Nije platio', bg: '#FAEEDA', color: '#633806' },
}

export default function GuestProfilePage() {
  const { id } = useParams()
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [guest, setGuest] = useState(null)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('visits')
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    table_number: '', party_size: 1, visit_type: 'walk_in',
    status: 'completed', amount_spent: '', notes: ''
  })

  useEffect(() => { if (restaurant) loadData() }, [restaurant, id])

  const loadData = async () => {
    setLoading(true)
    const [{ data: g }, { data: v }] = await Promise.all([
      supabase.from('guests').select('*').eq('id', id).single(),
      supabase.from('guest_visits').select('*').eq('guest_id', id).order('visit_date', { ascending: false }),
    ])
    if (g) { setGuest(g); setForm(g) }
    setVisits(v || [])
    setLoading(false)
  }

  const saveGuest = async () => {
    setSaving(true)
    const updates = {
      first_name: form.first_name, last_name: form.last_name,
      phone: form.phone || null, email: form.email || null,
      date_of_birth: form.date_of_birth || null,
      status: form.status, notes: form.notes || null,
      blacklist_reason: form.blacklist_reason || null,
    }
    const { data } = await supabase.from('guests').update(updates).eq('id', id).select().single()
    if (data) setGuest(data)
    setSaving(false); setEditMode(false)
  }

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/${id}.${ext}`
    await supabase.storage.from('guest-avatars').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('guest-avatars').getPublicUrl(path)
    const { data } = await supabase.from('guests').update({ avatar_url: publicUrl }).eq('id', id).select().single()
    if (data) setGuest(data)
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    await supabase.from('guests').update({ avatar_url: null }).eq('id', id)
    setGuest(g => ({ ...g, avatar_url: null }))
  }

  const saveVisit = async (e) => {
    e.preventDefault()
    const payload = {
      ...visitForm,
      guest_id: id,
      restaurant_id: restaurant.id,
      amount_spent: parseFloat(visitForm.amount_spent) || 0,
      party_size: parseInt(visitForm.party_size) || 1,
    }
    const { data } = await supabase.from('guest_visits').insert(payload).select().single()
    if (data) {
      setVisits(prev => [data, ...prev])
      // Refresh guest stats
      const { data: g } = await supabase.from('guests').select('*').eq('id', id).single()
      if (g) setGuest(g)
    }
    setShowVisitForm(false)
    setVisitForm({ visit_date: new Date().toISOString().split('T')[0], table_number: '', party_size: 1, visit_type: 'walk_in', status: 'completed', amount_spent: '', notes: '' })
  }

  const deleteVisit = async (visitId) => {
    if (!confirm('Obrisati posjetu?')) return
    await supabase.from('guest_visits').delete().eq('id', visitId)
    setVisits(prev => prev.filter(v => v.id !== visitId))
    const { data: g } = await supabase.from('guests').select('*').eq('id', id).single()
    if (g) setGuest(g)
  }

  if (loading) return <div className={styles.loading}>Učitavanje...</div>
  if (!guest) return <div className={styles.loading}>Gost nije pronađen.</div>

  const initials = `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`.toUpperCase()
  const avgSpent = guest.total_visits > 0 ? (parseFloat(guest.total_spent) / guest.total_visits).toFixed(2) : '0.00'

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/guests')}>← Gosti</button>
        <span>{guest.first_name} {guest.last_name}</span>
      </div>

      <div className={styles.profileCard}>
        {/* Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {guest.avatar_url
              ? <img src={guest.avatar_url} className={styles.profileAvatar} alt={guest.first_name} />
              : <div className={styles.profileAvatar} style={{ background: '#FAEEDA', color: '#633806', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 600 }}>{initials}</div>
            }
            <div className={styles.avatarActions}>
              <button className={styles.btnAvatarChange} onClick={() => fileRef.current.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? '...' : '📷'}
              </button>
              {guest.avatar_url && (
                <button className={styles.btnAvatarRemove} onClick={removeAvatar}>✕</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </div>

          <div className={styles.profileInfo}>
            {editMode ? (
              <div className={styles.editInline}>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Ime" />
                  <input className={styles.editInput} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Prezime" />
                </div>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Telefon" />
                  <input className={styles.editInput} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" />
                </div>
                <div className={styles.fieldRow}>
                  <input className={styles.editInput} type="date" value={form.date_of_birth || ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  <select className={styles.editInput} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="blacklist">Blacklist</option>
                  </select>
                </div>
                {form.status === 'blacklist' && (
                  <input className={styles.editInput} value={form.blacklist_reason || ''} onChange={e => setForm(f => ({ ...f, blacklist_reason: e.target.value }))} placeholder="Razlog blacklistanja..." />
                )}
              </div>
            ) : (
              <>
                <div className={styles.profileName}>{guest.first_name} {guest.last_name}</div>
                <div className={styles.profileSub}>
                  {guest.phone && <span>{guest.phone}</span>}
                  {guest.email && <span>{guest.email}</span>}
                  {guest.date_of_birth && <span>{new Date(guest.date_of_birth).toLocaleDateString('sr-Latn')}</span>}
                </div>
                <div className={styles.profileBadges}>
                  <span className={styles.badge} style={STATUS_STYLES[guest.status]}>{STATUS_LABELS[guest.status]}</span>
                  {guest.user_id && <span className={styles.badge} style={{ background: '#E1F5EE', color: '#085041' }}>Registrovan</span>}
                  {guest.blacklist_reason && <span className={styles.blacklistReason}>{guest.blacklist_reason}</span>}
                </div>
              </>
            )}
          </div>

          <div className={styles.headerActions}>
            {editMode ? (<>
              <button className={styles.btnPrimary} onClick={saveGuest} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
              <button className={styles.btnSecondary} onClick={() => { setEditMode(false); setForm(guest) }}>Odustani</button>
            </>) : (
              <button className={styles.btnSecondary} onClick={() => setEditMode(true)}>Uredi</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <div className={styles.statVal}>{guest.total_visits || 0}</div>
            <div className={styles.statLbl}>Posjeta ukupno</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal} style={{ color: '#0d7a52' }}>€{parseFloat(guest.total_spent || 0).toFixed(2)}</div>
            <div className={styles.statLbl}>Ukupno potrošeno</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal}>€{avgSpent}</div>
            <div className={styles.statLbl}>Prosj. po posjeti</div>
          </div>
          <div className={styles.statBox}>
            <div className={styles.statVal} style={{ color: guest.no_show_count > 0 ? '#A32D2D' : 'inherit' }}>{guest.no_show_count || 0}</div>
            <div className={styles.statLbl}>Incidenti</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[['visits', 'Posjete'], ['notes', 'Napomene'], ['account', 'Nalog']].map(([key, label]) => (
            <button key={key} className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>

        {/* Posjete */}
        {activeTab === 'visits' && (
          <div className={styles.tabContent}>
            <div className={styles.tabHeader}>
              <div className={styles.tabTitle}>Historija posjeta</div>
              <button className={styles.btnPrimary} onClick={() => setShowVisitForm(v => !v)}>+ Dodaj posjetu</button>
            </div>

            {showVisitForm && (
              <form onSubmit={saveVisit} className={styles.inlineForm}>
                <div className={styles.fieldRow}>
                  <div className={styles.field}><label>Datum</label><input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} required /></div>
                  <div className={styles.field}><label>Sto</label><input value={visitForm.table_number} onChange={e => setVisitForm(f => ({ ...f, table_number: e.target.value }))} placeholder="npr. 4" /></div>
                  <div className={styles.field}><label>Osoba</label><input type="number" min="1" value={visitForm.party_size} onChange={e => setVisitForm(f => ({ ...f, party_size: e.target.value }))} /></div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.field}><label>Tip</label>
                    <select value={visitForm.visit_type} onChange={e => setVisitForm(f => ({ ...f, visit_type: e.target.value }))}>
                      <option value="walk_in">Walk-in</option>
                      <option value="reservation">Rezervacija</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                  <div className={styles.field}><label>Status</label>
                    <select value={visitForm.status} onChange={e => setVisitForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="completed">Završena</option>
                      <option value="cancelled">Otkazana</option>
                      <option value="no_show">No-show</option>
                      <option value="unpaid">Nije platio</option>
                    </select>
                  </div>
                  <div className={styles.field}><label>Iznos (€)</label><input type="number" min="0" step="0.01" value={visitForm.amount_spent} onChange={e => setVisitForm(f => ({ ...f, amount_spent: e.target.value }))} placeholder="0.00" /></div>
                </div>
                <div className={styles.field}><label>Napomena</label><input value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcionalno..." /></div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowVisitForm(false)}>Odustani</button>
                  <button type="submit" className={styles.btnPrimary}>Sačuvaj</button>
                </div>
              </form>
            )}

            {visits.length === 0 ? (
              <div className={styles.empty}>Nema evidentiranih posjeta</div>
            ) : (
              <div className={styles.visitList}>
                {visits.map(v => (
                  <div key={v.id} className={styles.visitItem}>
                    <div className={styles.visitDate}>{new Date(v.visit_date).toLocaleDateString('sr-Latn')}</div>
                    <div className={styles.visitInfo}>
                      {v.table_number && `Sto ${v.table_number} · `}{v.party_size} {v.party_size === 1 ? 'osoba' : 'osobe'} · {v.visit_type === 'walk_in' ? 'Walk-in' : v.visit_type === 'reservation' ? 'Rezervacija' : 'Online'}
                    </div>
                    <span className={styles.visitBadge} style={{ background: VISIT_STATUS[v.status]?.bg, color: VISIT_STATUS[v.status]?.color }}>
                      {VISIT_STATUS[v.status]?.label}
                    </span>
                    <div className={styles.visitAmount} style={{ color: v.status === 'completed' ? '#0d7a52' : '#A32D2D' }}>
                      {v.amount_spent > 0 ? `€${parseFloat(v.amount_spent).toFixed(2)}` : '—'}
                    </div>
                    <button className={styles.delBtn} onClick={() => deleteVisit(v.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Napomene */}
        {activeTab === 'notes' && (
          <div className={styles.tabContent}>
            <div className={styles.field}>
              <label>Napomene o gostu</label>
              <textarea
                rows={6}
                value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Alergije, preference, posebni zahtjevi..."
                className={styles.notesArea}
              />
            </div>
            <div className={styles.saveRow}>
              <button className={styles.btnPrimary} onClick={saveGuest} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj napomene'}</button>
            </div>
          </div>
        )}

        {/* Nalog */}
        {activeTab === 'account' && (
          <div className={styles.tabContent}>
            {guest.user_id ? (
              <div className={styles.accountInfo}>
                <div className={styles.accountStatus}>
                  <span style={{ color: '#0d7a52', fontSize: 24 }}>✓</span>
                  <div>
                    <div className={styles.accountTitle}>Gost ima aktivan nalog</div>
                    <div className={styles.accountSub}>Može se prijaviti i pregledati rezervacije</div>
                    {guest.approved_at && <div className={styles.accountSub}>Odobreno: {new Date(guest.approved_at).toLocaleDateString('sr-Latn')}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.accountInfo}>
                <div className={styles.accountStatus}>
                  <span style={{ color: '#8a9e96', fontSize: 24 }}>○</span>
                  <div>
                    <div className={styles.accountTitle}>Gost nema nalog</div>
                    <div className={styles.accountSub}>Gost se može registrovati na stranici rezervacija — zahtjev ćeš vidjeti u listi "Na čekanju"</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
