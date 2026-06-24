import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/auditLog'
import { useMoney } from '../../../lib/useMoney'
import { currencyMeta } from '../../../lib/currencies'
import { useSpaServices } from '../hooks/useSpaServices'
import { useSpaTherapists } from '../hooks/useSpaTherapists'
import { useSpaRooms } from '../hooks/useSpaRooms'
import DateNav from '../../../components/shared/DateNav'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const STATUS_MAP = {
  confirmed:  { key: 'spaStConfirmed',  color: '#2563eb', bg: '#dbeafe' },
  checked_in: { key: 'spaStInProgress', color: '#0d7a52', bg: '#d1fae5' },
  completed:  { key: 'spaStCompleted',  color: '#6d28d9', bg: '#ede9fe' },
  cancelled:  { key: 'spaStCancelled',  color: '#9ca3af', bg: '#f3f4f6' },
  no_show:    { key: 'spaStNoShow',     color: '#c0392b', bg: '#fde0e0' },
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
  const { t } = useTranslation('admin')
  const money = useMoney()
  const curSym = currencyMeta(restaurant?.currency).symbol
  const { services }   = useSpaServices(restaurant?.id)
  const { therapists } = useSpaTherapists(restaurant?.id)
  const { rooms }      = useSpaRooms(restaurant?.id)

  const [from, setFrom]                   = useState(TODAY)
  const [to, setTo]                       = useState(TODAY)
  const [search, setSearch]               = useState('')
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
      .order('start_time')
    if (from) q = q.gte('appointment_date', from)
    if (to)   q = q.lte('appointment_date', to)

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)

    const { data } = await q
    setAppointments(data ?? [])
    setLoading(false)
  }, [restaurant, from, to, statusFilter])

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
      toast.error(t('spaFillRequired'))
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

    const { data: created, error } = await supabase.from('spa_appointments').insert(payload).select('id').single()
    setSaving(false)

    if (error) { toast.error(t('spaApptCreateErr')); return }
    toast.success(t('spaApptCreated'))
    logAudit({
      restaurantId: restaurant.id, action: 'spa_appointment.create',
      entityType: 'spa_appointment', entityId: created?.id,
      summary: `Spa termin: ${form.guest_name}${svc?.name ? ` — ${svc.name}` : ''}`,
      metadata: { date: form.appointment_date, time: form.start_time },
    })
    setShowForm(false)
    setForm(BLANK)
    load()
  }

  const updateStatus = async (id, status) => {
    const patch = { status }
    if (status === 'completed') patch.payment_status = 'paid'
    const { error } = await supabase.from('spa_appointments').update(patch).eq('id', id)
    if (error) { toast.error(t('spaUpdateErr')); return }
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    if (status === 'completed') {
      logAudit({
        restaurantId: restaurant.id, action: 'spa_appointment.complete',
        entityType: 'spa_appointment', entityId: id, summary: 'Spa termin završen',
      })
    }
    toast.success(t(STATUS_MAP[status]?.key))
  }

  const cancel = async (id) => {
    if (!window.confirm(t('spaCancelApptConfirm'))) return
    await supabase.from('spa_appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(),
    }).eq('id', id)
    logAudit({
      restaurantId: restaurant.id, action: 'spa_appointment.cancel',
      entityType: 'spa_appointment', entityId: id, summary: 'Spa termin otkazan',
    })
    load()
    toast.success(t('spaApptCancelled'))
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaApptTitle')}</h1>
          <p className={styles.subtitle}>{t('spaApptSubtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>+ {t('spaNewAppt')}</button>
        </div>
      </div>

      <DateNav
        from={from}
        to={to}
        search={search}
        onChange={(f, tt) => { setFrom(f); setTo(tt) }}
        onSearch={setSearch}
        showFuture={true}
        showMonth={true}
        allowAll={true}
        placeholder={t('spaSearchGuestTherapist')}
      />

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? t('spaAll') : t(STATUS_MAP[s]?.key)}
          </button>
        ))}
      </div>

      {/* New appointment form */}
      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{t('spaNewAppt')}</span>
            <button className={spa.formPanelClose} onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaTreatmentReq')}</label>
              <select className={spa.formSelect} value={form.service_id} onChange={e => upd('service_id', e.target.value)}>
                <option value="">{t('spaSelectTreatment')}</option>
                {services.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} {t('spaMinUnit')})</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaPrice')} ({curSym})</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaDateReq')}</label>
              <input className={spa.formInput} type="date" value={form.appointment_date} onChange={e => upd('appointment_date', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaStartReq')}</label>
              <input className={spa.formInput} type="time" value={form.start_time} onChange={e => upd('start_time', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaTherapist')}</label>
              <select className={spa.formSelect} value={form.therapist_id} onChange={e => upd('therapist_id', e.target.value)}>
                <option value="">{t('spaUnassigned')}</option>
                {therapists.map(tp => (
                  <option key={tp.id} value={tp.id}>
                    {tp.staff?.first_name} {tp.staff?.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaRoom')}</label>
              <select className={spa.formSelect} value={form.spa_room_id} onChange={e => upd('spa_room_id', e.target.value)}>
                <option value="">{t('spaNotSelected')}</option>
                {rooms.filter(r => r.is_active).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaGuestNameReq')}</label>
              <input className={spa.formInput} value={form.guest_name} onChange={e => upd('guest_name', e.target.value)} placeholder="Marko Marković" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaGuestEmail')}</label>
              <input className={spa.formInput} type="email" value={form.guest_email} onChange={e => upd('guest_email', e.target.value)} placeholder="marko@email.com" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaPhone')}</label>
              <input className={spa.formInput} type="tel" value={form.guest_phone} onChange={e => upd('guest_phone', e.target.value)} placeholder="+387 61 000 000" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaPayment')}</label>
              <select className={spa.formSelect} value={form.payment_method} onChange={e => upd('payment_method', e.target.value)}>
                <option value="cash">{t('spaPayReception')}</option>
                <option value="folio">{t('spaPayFolio')}</option>
                <option value="card">{t('spaPayCard')}</option>
              </select>
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaInternalNotes')}</label>
              <textarea className={spa.formTextarea} rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder={t('spaNotesPh')} />
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('spaCreating') : t('spaCreateAppt')}
            </button>
          </div>
        </div>
      )}

      {/* Appointments table */}
      {loading ? <LoadingSpinner /> : (() => {
        const q = search.toLowerCase()
        const filtered = appointments.filter(a => {
          if (!q) return true
          const therapistName = a.spa_therapists?.staff
            ? `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`.toLowerCase()
            : ''
          return (
            (a.external_guest_name || '').toLowerCase().includes(q) ||
            (a.spa_services?.name || '').toLowerCase().includes(q) ||
            therapistName.includes(q)
          )
        })
        return filtered.length === 0 ? (
          <div className={spa.empty}>
            <div className={spa.emptyIcon}>🗓️</div>
            <p>{t('spaNoApptsPeriod')}{statusFilter !== 'all' ? t('spaAndStatus') : ''}{search ? t('spaAndSearch') : ''}.</p>
          </div>
        ) : (
          <div className={spa.tableScroll} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
          <table className={spa.table}>
            <thead>
              <tr>
                <th>{t('spaTime')}</th>
                <th>{t('spaTreatment')}</th>
                <th>{t('spaTherapist')}</th>
                <th>{t('spaGuest')}</th>
                <th>{t('spaPrice')}</th>
                <th>{t('spaStatus')}</th>
                <th>{t('spaThActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const sl = STATUS_MAP[a.status] || STATUS_MAP.confirmed
                const therapistName = a.spa_therapists?.staff
                  ? `${a.spa_therapists.staff.first_name} ${a.spa_therapists.staff.last_name}`
                  : '—'
                const guestName = a.external_guest_name || t('spaHotelGuestParen')
                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.start_time?.slice(0,5)} – {a.end_time?.slice(0,5)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.spa_services?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{a.duration_minutes} {t('spaMinUnit')}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{therapistName}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{guestName}</div>
                      {a.external_guest_email && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{a.external_guest_email}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{money(a.price)}</td>
                    <td>
                      <span className={spa.badge} style={{ background: sl.bg, color: sl.color }}>{t(sl.key)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.status === 'confirmed' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'checked_in')}>▶ {t('spaStart')}</button>
                        )}
                        {a.status === 'checked_in' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'completed')}>✓ {t('spaFinish')}</button>
                        )}
                        {a.status === 'completed' && a.payment_status !== 'paid' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: '#0d7a52', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'completed')}>💶 {t('spaCharge')}</button>
                        )}
                        {(a.status === 'confirmed' || a.status === 'checked_in') && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => cancel(a.id)}>{t('spaCancelBtn')}</button>
                        )}
                        {a.status === 'confirmed' && (
                          <button style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => updateStatus(a.id, 'no_show')}>{t('spaStNoShow')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )
      })()}
    </div>
  )
}
