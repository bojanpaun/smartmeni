// ▶ Novi fajl: src/modules/guests/pages/GuestsPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GuestsPage.module.css'

const STATUS_LABELS = {
  regular: 'Regular', vip: 'VIP', blacklist: 'Blacklist', pending: 'Na čekanju'
}
const STATUS_STYLES = {
  regular: { background: '#f0f5f2', color: '#5a7a6a' },
  vip: { background: '#FAEEDA', color: '#633806' },
  blacklist: { background: '#FCEBEB', color: '#791F1F' },
  pending: { background: '#E6F1FB', color: '#0C447C' },
}

const EMPTY_FORM = {
  first_name: '', last_name: '', phone: '', email: '',
  date_of_birth: '', status: 'regular', notes: ''
}

export default function GuestsPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (restaurant) loadGuests() }, [restaurant])

  const loadGuests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('guests')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
    setGuests(data || [])
    setLoading(false)
  }

  const saveGuest = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      date_of_birth: form.date_of_birth || null,
      restaurant_id: restaurant.id,
    }
    const { data } = await supabase.from('guests').insert(payload).select().single()
    if (data) setGuests(prev => [data, ...prev])
    setSaving(false); setShowForm(false); setForm(EMPTY_FORM)
  }

  const approveGuest = async (e, id) => {
    e.stopPropagation()
    const { data } = await supabase
      .from('guests').update({ status: 'regular', approved_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (data) setGuests(prev => prev.map(g => g.id === id ? data : g))
  }

  const rejectGuest = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Odbiti zahtjev gosta?')) return
    await supabase.from('guests').delete().eq('id', id)
    setGuests(prev => prev.filter(g => g.id !== id))
  }

  const filtered = guests.filter(g => {
    if (filter !== 'all' && g.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return `${g.first_name} ${g.last_name}`.toLowerCase().includes(q) ||
        g.phone?.includes(q) || g.email?.toLowerCase().includes(q)
    }
    return true
  })

  const pendingCount = guests.filter(g => g.status === 'pending').length
  const initials = (g) => `${g.first_name?.[0] || ''}${g.last_name?.[0] || ''}`.toUpperCase()
  const fullName = (g) => `${g.first_name} ${g.last_name}`

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.title}>Gosti</div>
        <div className={styles.topbarActions}>
          {pendingCount > 0 && (
            <button className={styles.btnPending} onClick={() => setFilter('pending')}>
              Na čekanju ({pendingCount})
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
            + Dodaj gosta
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Pretraži po imenu, telefonu, emailu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filters}>
          {['all', 'regular', 'vip', 'blacklist', 'pending'].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Svi' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <div className={styles.emptyTitle}>Nema gostiju</div>
          <div className={styles.emptyDesc}>Dodaj prvog gosta ili sačekaj online registracije</div>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ Dodaj gosta</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Gost</th>
                <th>Status</th>
                <th>Posjete</th>
                <th>Potrošnja</th>
                <th>Zadnja posjeta</th>
                <th style={{ textAlign: 'right' }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id} className={styles.tableRow} onClick={() => navigate(`/admin/guests/${g.id}`)}>
                  <td>
                    <div className={styles.nameCell}>
                      {g.avatar_url
                        ? <img src={g.avatar_url} className={styles.avatar} alt={fullName(g)} />
                        : <div className={styles.avatar} style={{ background: '#FAEEDA', color: '#633806' }}>{initials(g)}</div>
                      }
                      <div>
                        <div className={styles.guestName}>{fullName(g)}</div>
                        <div className={styles.guestSub}>{g.phone || g.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.badge} style={STATUS_STYLES[g.status]}>
                      {STATUS_LABELS[g.status]}
                    </span>
                  </td>
                  <td className={styles.numCell}>{g.total_visits || 0}</td>
                  <td className={styles.spentCell}>
                    {g.total_spent > 0 ? `€${parseFloat(g.total_spent).toFixed(2)}` : '—'}
                  </td>
                  <td className={styles.dateCell}>
                    {g.updated_at ? new Date(g.updated_at).toLocaleDateString('sr-Latn') : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.rowActions}>
                      {g.status === 'pending' ? (<>
                        <button className={styles.btnApprove} onClick={e => approveGuest(e, g.id)}>Odobri</button>
                        <button className={styles.btnReject} onClick={e => rejectGuest(e, g.id)}>Odbij</button>
                      </>) : (
                        <button className={styles.btnEdit} onClick={() => navigate(`/admin/guests/${g.id}`)}>Profil</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Dodaj gosta</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveGuest}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Ime *</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>Prezime *</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Telefon</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 ..." />
                </div>
                <div className={styles.field}>
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Datum rođenja</label>
                  <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="blacklist">Blacklist</option>
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label>Napomene</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Alergije, preference, napomene..." />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Čuvanje...' : 'Dodaj gosta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
