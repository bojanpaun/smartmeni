import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)
const STATUS_MAP = {
  confirmed:   { label: 'Potvrđen',  color: '#2563eb' },
  checked_in:  { label: 'Aktivan',   color: '#0d7a52' },
  completed:   { label: 'Završen',   color: '#9ca3af' },
  cancelled:   { label: 'Otkazan',   color: '#c0392b' },
  no_show:     { label: 'No-show',   color: '#ef9f27' },
}

export default function SpaView({ staffId, restaurantId, onRefresh }) {
  const [appointments, setAppointments] = useState([])
  const [therapistId, setTherapistId]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!staffId || !restaurantId) return
    const { data: therapist } = await supabase.from('spa_therapists')
      .select('id')
      .eq('staff_id', staffId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!therapist) { setLoading(false); return }

    setTherapistId(therapist.id)

    const { data } = await supabase.from('spa_appointments')
      .select(`
        id, start_time, end_time, duration_minutes, status, notes, guest_notes,
        spa_services(name, category),
        spa_rooms(name),
        guest_id,
        external_guest_name
      `)
      .eq('restaurant_id', restaurantId)
      .eq('therapist_id', therapist.id)
      .eq('appointment_date', TODAY)
      .not('status', 'in', '(cancelled,no_show)')
      .order('start_time')

    setAppointments(data ?? [])
    setLoading(false)
  }, [staffId, restaurantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const handleChange = () => { load(); onRefresh?.() }
    const ch = supabase.channel(`spa-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spa_appointments',
        filter: `restaurant_id=eq.${restaurantId}` }, handleChange)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load, onRefresh])

  const updateStatus = async (id, status) => {
    await supabase.from('spa_appointments').update({ status }).eq('id', id)
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    onRefresh?.()
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje termina...</div>

  if (!therapistId) return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>💆</div>
      <div className={s.emptyText}>Niste registrovani kao terapeut.</div>
    </div>
  )

  return (
    <div>
      {appointments.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>💆</div>
          <div className={s.emptyText}>Nemate termina za danas.</div>
        </div>
      ) : appointments.map(appt => {
        const st = STATUS_MAP[appt.status] || STATUS_MAP.confirmed
        const guestName = appt.external_guest_name || (appt.guest_id ? 'Hotelski gost' : '—')
        const isDone = appt.status === 'completed'
        return (
          <div key={appt.id} className={`${s.apptCard} ${isDone ? s.completed : ''}`}>
            <div className={s.apptTime}>
              {appt.start_time?.slice(0,5)} – {appt.end_time?.slice(0,5)}
            </div>
            <div className={s.apptService}>{appt.spa_services?.name || '—'}</div>
            <div className={s.apptGuest}>👤 {guestName}</div>
            <div className={s.apptMeta}>
              <span className={s.apptDuration}>⏱ {appt.duration_minutes} min</span>
              {appt.spa_rooms?.name && <span className={s.apptRoom}>🚪 {appt.spa_rooms.name}</span>}
              <span className={s.badge} style={{ background: '#f3f4f6', color: st.color }}>{st.label}</span>
            </div>
            {appt.guest_notes && (
              <div className={s.taskNotes} style={{ marginTop: 8 }}>💬 {appt.guest_notes}</div>
            )}
            <div className={s.taskActionRow} style={{ marginTop: 10 }}>
              {appt.status === 'confirmed' && (
                <button className={s.btnStart} onClick={() => updateStatus(appt.id, 'checked_in')}>▶ Počni</button>
              )}
              {appt.status === 'checked_in' && (
                <button className={s.btnDone} onClick={() => updateStatus(appt.id, 'completed')}>✓ Završi</button>
              )}
              {!isDone && (
                <button
                  style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}
                  onClick={() => updateStatus(appt.id, 'no_show')}
                >
                  No-show
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
