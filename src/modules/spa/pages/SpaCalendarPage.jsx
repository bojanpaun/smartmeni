import { useState, useEffect, useRef } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import cal from './SpaCalendar.module.css'

// ── Helpers ──────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function pct(timeStr, openMin, totalMin) {
  return Math.max(0, Math.min(100, ((timeToMin(timeStr) - openMin) / totalMin) * 100))
}

function durationPct(startTime, endTime, totalMin) {
  return Math.max(0, Math.min(100, ((timeToMin(endTime) - timeToMin(startTime)) / totalMin) * 100))
}

function generateSlots(openMin, closeMin, stepMin = 30) {
  const slots = []
  for (let m = openMin; m <= closeMin; m += stepMin) {
    slots.push(m)
  }
  return slots
}

function shiftDate(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sr-Latn', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Status styles ─────────────────────────────────────────────

const STATUS = {
  confirmed:  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: 'Potvrđen' },
  checked_in: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', label: 'U toku' },
  completed:  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', label: 'Završen' },
  cancelled:  { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', label: 'Otkazan' },
  no_show:    { bg: '#fde0e0', color: '#c0392b', border: '#fca5a5', label: 'No-show' },
}

const CATEGORY_ICON = {
  massage: '💆', facial: '✨', body: '🧖',
  nail: '💅', wellness: '🌿', group: '👥',
}

// ── Main Component ────────────────────────────────────────────

export default function SpaCalendarPage() {
  const { restaurant } = usePlatform()
  const [date, setDate]           = useState(TODAY)
  const [view, setView]           = useState('therapists') // 'therapists' | 'rooms'
  const [therapists, setTherapists] = useState([])
  const [rooms, setRooms]         = useState([])
  const [appointments, setAppts]  = useState([])
  const [openMin, setOpenMin]     = useState(timeToMin('09:00'))
  const [closeMin, setCloseMin]   = useState(timeToMin('20:00'))
  const [loading, setLoading]     = useState(true)
  const [popup, setPopup]         = useState(null) // { appt, x, y }
  const popupRef                  = useRef()

  useEffect(() => {
    if (!restaurant) return
    async function load() {
      setLoading(true)

      const [{ data: settings }, { data: t }, { data: r }, { data: a }] = await Promise.all([
        supabase.from('spa_settings').select('open_time, close_time').eq('restaurant_id', restaurant.id).maybeSingle(),
        supabase.from('spa_therapists')
          .select('id, staff!staff_id(first_name, last_name, role)')
          .eq('restaurant_id', restaurant.id)
          .eq('is_available', true),
        supabase.from('spa_rooms')
          .select('id, name, type')
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .order('display_order'),
        supabase.from('spa_appointments')
          .select(`
            id, start_time, end_time, duration_minutes, price, status,
            external_guest_name, guest_id, payment_method,
            spa_services(name, category),
            spa_therapists(id, staff!staff_id(first_name, last_name)),
            spa_rooms(id, name)
          `)
          .eq('restaurant_id', restaurant.id)
          .eq('appointment_date', date)
          .not('status', 'in', '(cancelled,no_show)'),
      ])

      if (settings) {
        setOpenMin(timeToMin(settings.open_time || '09:00'))
        setCloseMin(timeToMin(settings.close_time || '20:00'))
      }
      setTherapists(t ?? [])
      setRooms(r ?? [])
      setAppts(a ?? [])
      setLoading(false)
    }
    load()
  }, [restaurant, date])

  // Close popup on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popup && popupRef.current && !popupRef.current.contains(e.target)) {
        setPopup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popup])

  if (!restaurant) return <LoadingSpinner fullPage />

  const totalMin = closeMin - openMin
  const slots    = generateSlots(openMin, closeMin, 30)

  // Current time line — only on today
  const nowMin = timeToMin(new Date().toTimeString().slice(0, 5))
  const nowPct = date === TODAY && nowMin >= openMin && nowMin <= closeMin
    ? pct(minToTime(nowMin), openMin, totalMin)
    : null

  // Group appointments by therapist and room
  const byTherapist = {}
  const byRoom = {}
  appointments.forEach(a => {
    const tid = a.spa_therapists?.id
    if (tid) {
      if (!byTherapist[tid]) byTherapist[tid] = []
      byTherapist[tid].push(a)
    }
    const rid = a.spa_rooms?.id
    if (rid) {
      if (!byRoom[rid]) byRoom[rid] = []
      byRoom[rid].push(a)
    }
  })

  const rows = view === 'therapists'
    ? therapists.map(t => ({
        id: t.id,
        name: t.staff ? `${t.staff.first_name} ${t.staff.last_name}` : '—',
        sub: t.staff?.role,
        appts: byTherapist[t.id] ?? [],
      }))
    : rooms.map(r => ({
        id: r.id,
        name: r.name,
        sub: r.type?.replace('_', ' '),
        appts: byRoom[r.id] ?? [],
      }))

  const openApptBar = (e, appt) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPopup({ appt, x: rect.left, y: rect.bottom + 8 })
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Spa kalendar</h1>
          <p className={styles.subtitle}>{fmtDate(date)}</p>
        </div>
        <div className={styles.headerActions} style={{ flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div className={cal.viewToggle}>
            <button
              className={`${cal.viewBtn} ${view === 'therapists' ? cal.viewBtnActive : ''}`}
              onClick={() => setView('therapists')}
            >
              👤 Terapeuti
            </button>
            <button
              className={`${cal.viewBtn} ${view === 'rooms' ? cal.viewBtnActive : ''}`}
              onClick={() => setView('rooms')}
            >
              🚪 Kabine
            </button>
          </div>

          {/* Date nav */}
          <button className={styles.btnSecondary} onClick={() => setDate(d => shiftDate(d, -1))}>‹</button>
          <button className={styles.btnSecondary} onClick={() => setDate(TODAY)}>Danas</button>
          <button className={styles.btnSecondary} onClick={() => setDate(d => shiftDate(d, 1))}>›</button>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid var(--c-border-input)', borderRadius: 9, fontSize: 13, background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <div className={cal.empty}>
          <p>{view === 'therapists' ? 'Nema aktivnih terapeuta.' : 'Nema aktivnih kabina.'}</p>
        </div>
      ) : (
        <div className={cal.calendarWrap}>
          <div className={cal.calendarInner}>

            {/* Time header row */}
            <div className={cal.headerRow}>
              <div className={cal.labelCol}>
                {view === 'therapists' ? 'Terapeut' : 'Kabina'}
              </div>
              <div className={cal.timelineHeader}>
                {slots.map(m => (
                  <div
                    key={m}
                    className={`${cal.timeLabel} ${m % 60 === 0 ? cal.timeLabelHour : ''}`}
                    style={{ left: `${pct(minToTime(m), openMin, totalMin)}%` }}
                  >
                    {m % 60 === 0 ? minToTime(m) : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {rows.map(row => (
              <div key={row.id} className={cal.row}>
                <div className={cal.rowLabel}>
                  <div className={cal.rowName}>{row.name}</div>
                  {row.sub && <div className={cal.rowSub}>{row.sub}</div>}
                </div>

                <div className={cal.timeline}>
                  {/* Background slot grid */}
                  {slots.map(m => (
                    <div
                      key={m}
                      className={`${cal.slotBg} ${m % 60 === 0 ? cal.slotBgHour : ''}`}
                      style={{ left: `${pct(minToTime(m), openMin, totalMin)}%` }}
                    />
                  ))}

                  {/* Current time line */}
                  {nowPct !== null && (
                    <div className={cal.nowLine} style={{ left: `${nowPct}%` }} />
                  )}

                  {/* Appointment bars */}
                  {row.appts.map(appt => {
                    const s = STATUS[appt.status] ?? STATUS.confirmed
                    const cat = appt.spa_services?.category
                    const guestName = appt.external_guest_name
                      || (appt.guest_id ? 'Hotelski gost' : '—')
                    const left  = pct(appt.start_time, openMin, totalMin)
                    const width = durationPct(appt.start_time, appt.end_time, totalMin)

                    return (
                      <div
                        key={appt.id}
                        className={cal.apptBar}
                        style={{
                          left:   `${left}%`,
                          width:  `${width}%`,
                          background:   s.bg,
                          color:        s.color,
                          borderColor:  s.border,
                        }}
                        onClick={e => openApptBar(e, appt)}
                        title={`${appt.spa_services?.name} — ${guestName} (${appt.start_time?.slice(0,5)}–${appt.end_time?.slice(0,5)})`}
                      >
                        <div className={cal.apptContent}>
                          <div className={cal.apptName}>
                            {CATEGORY_ICON[cat] || '💆'} {appt.spa_services?.name}
                          </div>
                          <div className={cal.apptTime}>
                            {appt.start_time?.slice(0, 5)}–{appt.end_time?.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className={cal.legend}>
            {Object.entries(STATUS).filter(([k]) => k !== 'cancelled' && k !== 'no_show').map(([key, s]) => (
              <div key={key} className={cal.legendItem}>
                <span className={cal.legendDot} style={{ background: s.bg, borderColor: s.border }} />
                {s.label}
              </div>
            ))}
            {nowPct !== null && (
              <div className={cal.legendItem}>
                <span className={cal.legendDot} style={{ background: '#ef4444', borderColor: '#ef4444', borderRadius: '50%' }} />
                Trenutno vrijeme
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appointment detail popup */}
      {popup && (
        <div
          ref={popupRef}
          className={cal.popup}
          style={{
            top:  Math.min(popup.y, window.innerHeight - 220),
            left: Math.min(popup.x, window.innerWidth - 320),
          }}
        >
          <button className={cal.popupClose} onClick={() => setPopup(null)}>✕</button>
          <div className={cal.popupTitle}>
            {CATEGORY_ICON[popup.appt.spa_services?.category] || '💆'} {popup.appt.spa_services?.name}
          </div>
          <div className={cal.popupRow}>
            <span>🕐</span>
            <span>{popup.appt.start_time?.slice(0,5)} – {popup.appt.end_time?.slice(0,5)} ({popup.appt.duration_minutes} min)</span>
          </div>
          {popup.appt.spa_therapists?.staff && (
            <div className={cal.popupRow}>
              <span>👤</span>
              <span>{popup.appt.spa_therapists.staff.first_name} {popup.appt.spa_therapists.staff.last_name}</span>
            </div>
          )}
          {popup.appt.spa_rooms && (
            <div className={cal.popupRow}>
              <span>🚪</span>
              <span>{popup.appt.spa_rooms.name}</span>
            </div>
          )}
          <div className={cal.popupRow}>
            <span>👤</span>
            <span>{popup.appt.external_guest_name || (popup.appt.guest_id ? 'Hotelski gost' : '—')}</span>
          </div>
          <div className={cal.popupRow}>
            <span>💶</span>
            <span>€{Number(popup.appt.price).toFixed(2)} · {popup.appt.payment_method}</span>
          </div>
          <div className={cal.popupRow}>
            <span>📌</span>
            <span style={{ color: STATUS[popup.appt.status]?.color }}>
              {STATUS[popup.appt.status]?.label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
