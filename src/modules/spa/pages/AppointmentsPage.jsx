import { useState, useEffect, useCallback } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useSpaServices } from '../hooks/useSpaServices'
import { useSpaTherapists } from '../hooks/useSpaTherapists'
import { useSpaRooms } from '../hooks/useSpaRooms'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const STATUS_MAP = {
  confirmed:  { label: 'Potvrđen',  color: '#2563eb', bg: '#dbeafe' },
  checked_in: { label: 'U toku',    color: '#0d7a52', bg: '#d1fae5' },
  completed:  { label: 'Završen',   color: '#6d28d9', bg: '#ede9fe' },
  cancelled:  { label: 'Otkazan',   color: '#9ca3af', bg: '#f3f4f6' },
  no_show:    { label: 'No-show',   color: '#c0392b', bg: '#fde0e0' },
}

const BLANK = {
  service_id: '', therapist_id: '', spa_room_id: '',
  appointment_date: TODAY, start_time: '10:00',
  guest_name: '', guest_email: '', guest_phone: '',
  price: '', payment_method: 'cash', notes: '',
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function AppointmentsPage() {
  const { restaurant } = usePlatform()
  const { services }   = useSpaServices(restaurant?.id)
  const { therapists } = useSpaTherapists(restaurant?.id)
  const { rooms }      = useSpaRooms(restaurant?.id)

  const [dateFilter, setDateFilter]       = useState(TODAY)
  const [statusFilter, setStatusFilter]   = useState('all')
  const [appointments, setAppointments]   = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm]                   = useState(BLANK)
  const [saving, setSaving]               = useState(false)

  const load = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    let q = supabase
      .from('spa_appointments')
      .select(`
        id, status, price, duration_minutes, appointment_date,
        start_time, end_time, payment_method, payment_status,
        external_guest_name, external_guest_email, notes,
        spa_services(name, category, duration_minutes),
        spa_therapists(id, staff!staff_id(first_name, last_name)),
        spa_rooms(id, name)
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('appointment_date', dateFilter)
      .order('start_time')

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data } = await q
    setAppointments(data ?? [])
    setLoading(false)
  }, [restaurant, dateFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fill price from selected service
  useEffect(() => {
    if (!form.service_id) return
    const svc = services.find(s => s.id === form.service_id)
    if (svc) setForm(f => ({ ...f, price: String(svc.price) }))
  }, [form.service_id, services])

  const handleSave = async () => {
    if (!form.service_id || !form.appointment_date || !form.start_time || !form.guest_name) {
      toast.error('Popunite obavezna polja (tretman, datum, vrijeme, ime gosta)')
      return
    }
    setSaving(true)

    const svc = services.find(s => s.id === form.service_id)
    const duration = svc?.duration_minutes || 60
    const endTime  = addMinutes(form.start_time, duration)

    const payload = {
      restaurant_id:       restaurant.id,
      service_id:          form.service_id,
      therapist_id:        form.therapist_id || null,
      spa_room_id:         form.spa_room_id  || null,
      appointment_date:    form.appointment_date,
      start_time:          form.start_time,
      end_time:            endTime,
      duration_minutes:    duration,
      external_guest_name: form.guest_name,
      external_guest_email: form.guest_email || null,
      external_guest_phone: form.guest_phone || null,
      price:               Number(form.price) || 0,
      payment_method:      form.payment_method,
      notes:               form.notes || null,
      status:              'confirmed',
      payment_status:      'pending',
    }

    const { error } = await supabase.from('spa_appointments').insert(payload)
    setSaving(false)

    if (error) { toast.error('Greška pri kreiranju termina'); return }
    toast.success('Termin kreiran')
    setShowForm(false)
    setForm(BLANK)
    load()
  }

  const updateStatus = async (id, status) => {
    const patch = { status }
    if (status === 'completed') patch.payment_status = 'paid'
    const { error } = await supabase.from('spa_appointments').update(patch).eq('id', id)
    if (error) { toast.error('Greška pri ažuriranju'); return }
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    toast.success(STATUS_MAP[status]?.label)
  }

  const cancel = async (id) => {
    if (!window.confirm('Otkazati ovaj termin?')) return
    await supabase.from('spa_appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(),
    }).eq('id', id)
    load()
    toast.success('Termin otkazan')
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Termini</h1>
          <p className={styles.subtitle}>Pregled i upravljanje spa terminima</p>
        </div>
        <div className={styles.headerActions}>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid var(--c-border-input)', borderRadius: 9, fontSize: 13, background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }}
          />
          <button className={styles.btnSecondary} onClick={() => setDateFilter(TODAY)}>Danas</button>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ Novi termin</button>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Svi' : STATUS_MAP[s]?.label}
          </button>
        ))}
      </div>

      {/* New appointment form */}
      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>Novi termin</span>
            <button className={spa.formPanelClose} onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Tretman *</label>
              <select className={spa.formSelect} value={form.service_id} onChange={e => upd('service_id', e.target.value)}>
                <option value="">— Odaberite tretman —</option>
                {services.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Cijena (€)</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Datum *</label>
              <input className={spa.formInput} type="date" value={form.appointment_date} onChange={e => upd('appointment_date', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Početak *</label>
              <input className={spa.formInput} type="time" value={form.start_time} onChange={e => upd('start_time', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Terapeut</label>
              <select className={spa.formSelect} value={form.therapist_id} onChange={e => upd('therapist_id', e.target.value)}>
                <option value="">— Nedodijeljeno —</option>
                {therapists.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.staff?.first_name} {t.staff?.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Kabina</label>
              <select className={spa.formSelect} value={form.spa_room_id} onChange={e => upd('spa_room_id', e.target.value)}>
                <option value="">— Nije odabrano —</option>
                {rooms.filter(r => r.is_active).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Ime gosta *</label>
              <input className={spa.formInput} value={form.guest_name} onChange={e => upd('guest_name', e.target.value)} placeholder="Marko Marković" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Email gosta</label>
              <input className={spa.formInput} type="email" value={form.guest_email} onChange={e => upd('guest_email', e.target.value)} placeholder="marko@email.com" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Telefon</label>
              <input className={spa.formInput} type="tel" value={form.guest_phone} onChange={e => upd('guest_phone', e.target.value)} placeholder="+387 61 000 000" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Plaćanje</label>
              <select className={spa.formSelect} value={form.payment_method} onChange={e => upd('payment_method', e.target.value)}>
                <option value="cash">Na recepciji</option>
                <option value="folio">Na sobu (folio)</option>
                <option value="card">Kartica</option>
              </select>
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Interni notes</label>
              <textarea className={spa.formTextarea} rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Napomene za terapeuta..." />
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Kreiranje...' : 'Kreiraj termin'}
            </button>
          </div>
        </div>
      )}

      {/* Appointments table */}
      {loading ? <LoadingSpinner /> : appointments.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>🗓️</div>
          <p>Nema termina za odabrani dan{statusFilter !== 'all' ? ' i status' : ''}.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
          <table className={spa.table}>
            <thead>
              <tr>
                <th>Vrijeme</th>
                <th>Tretman</th>
                <th>Terapeut</th>
                <th>Gost</th>
                <th>Cijena</th>
                <th>Status</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => {
                const sl = STATUS_MAP[a.status] || STATUS_MAP.confirmed
                const therapistName = a.spa_therapists?.staff
                  ? `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`
                  : '—'
                const guestName = a.external_guest_name || '(hotelski gost)'
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.start_time?.slice(0,5)} – {a.end_time?.slice(0,5)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.spa_services?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{a.duration_minutes} min</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{therapistName}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{guestName}</div>
                      {a.external_guest_email && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{a.external_guest_email}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>€{Number(a.price).toFixed(2)}</td>
                    <td>
                      <span className={spa.badge} style={{ background: sl.bg, color: sl.color }}>{sl.label}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.status === 'confirmed' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'checked_in')}>▶ Počni</button>
                        )}
                        {a.status === 'checked_in' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'completed')}>✓ Završi</button>
                        )}
                        {a.status === 'completed' && a.payment_status !== 'paid' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: '#0d7a52', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'completed')}>💶 Naplati</button>
                        )}
                        {(a.status === 'confirmed' || a.status === 'checked_in') && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => cancel(a.id)}>Otkaži</button>
                        )}
                        {a.status === 'confirmed' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'no_show')}>No-show</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
