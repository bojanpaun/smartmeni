// ▶ Novi fajl: src/modules/hr/pages/SchedulePage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './SchedulePage.module.css'

const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
const STAFF_COLORS = [
  '#0d7a52', '#378add', '#7f77dd', '#d85a30',
  '#d4537e', '#1d9e75', '#ba7517', '#993556',
]

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - day + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

function fmtDisplay(date) {
  return date.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })
}

export default function SchedulePage() {
  const { restaurant, isOwner, isSuperAdmin } = usePlatform()
  const isAdmin = isOwner() || isSuperAdmin()

  const [staff, setStaff] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editSchedule, setEditSchedule] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    staff_id: '',
    date: '',
    start_time: '08:00',
    end_time: '16:00',
    note: '',
  })

  const weekDates = getWeekDates(weekOffset)
  const weekStart = fmt(weekDates[0])
  const weekEnd = fmt(weekDates[6])

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant, weekOffset])

  const loadData = async () => {
    setLoading(true)
    const [{ data: s }, { data: sch }] = await Promise.all([
      supabase.from('staff').select('id, email, user_profiles(full_name, avatar_url)')
        .eq('restaurant_id', restaurant.id).eq('is_active', true).order('email'),
      supabase.from('work_schedules').select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('date', weekStart).lte('date', weekEnd),
    ])
    setStaff(s || [])
    setSchedules(sch || [])
    setLoading(false)
  }

  const getSchedule = (staffId, date) =>
    schedules.find(s => s.staff_id === staffId && s.date === date)

  const openForm = (staffId = '', date = '', existing = null) => {
    if (existing) {
      setEditSchedule(existing)
      setForm({
        staff_id: existing.staff_id,
        date: existing.date,
        start_time: existing.start_time.slice(0, 5),
        end_time: existing.end_time.slice(0, 5),
        note: existing.note || '',
      })
    } else {
      setEditSchedule(null)
      setForm({ staff_id: staffId, date, start_time: '08:00', end_time: '16:00', note: '' })
    }
    setShowForm(true)
  }

  const saveSchedule = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      staff_id: form.staff_id,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      note: form.note || null,
      status: 'scheduled',
    }

    if (editSchedule) {
      await supabase.from('work_schedules').update(payload).eq('id', editSchedule.id)
      setSchedules(prev => prev.map(s => s.id === editSchedule.id ? { ...s, ...payload } : s))
    } else {
      const { data } = await supabase.from('work_schedules')
        .upsert(payload, { onConflict: 'staff_id,date' }).select().single()
      setSchedules(prev => {
        const filtered = prev.filter(s => !(s.staff_id === form.staff_id && s.date === form.date))
        return [...filtered, data]
      })
    }
    setSaving(false)
    setShowForm(false)
  }

  const deleteSchedule = async (id) => {
    await supabase.from('work_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    setShowForm(false)
  }

  const copyPrevWeek = async () => {
    if (!confirm('Kopirati raspored iz prethodne sedmice?')) return
    const prevDates = getWeekDates(weekOffset - 1)
    const { data: prevSchedules } = await supabase.from('work_schedules')
      .select('*').eq('restaurant_id', restaurant.id)
      .gte('date', fmt(prevDates[0])).lte('date', fmt(prevDates[6]))

    if (!prevSchedules?.length) { alert('Nema rasporeda u prethodnoj sedmici.'); return }

    const newSchedules = prevSchedules.map(s => {
      const prevDate = new Date(s.date)
      const newDate = new Date(prevDate)
      newDate.setDate(prevDate.getDate() + 7)
      return {
        restaurant_id: restaurant.id,
        staff_id: s.staff_id,
        date: fmt(newDate),
        start_time: s.start_time,
        end_time: s.end_time,
        note: s.note,
        status: 'scheduled',
      }
    })

    await supabase.from('work_schedules').upsert(newSchedules, { onConflict: 'staff_id,date' })
    loadData()
  }

  const staffName = (s) => s.user_profiles?.full_name || s.email.split('@')[0]
  const staffColor = (idx) => STAFF_COLORS[idx % STAFF_COLORS.length]

  if (loading) return <div className={styles.loading}>Učitavanje rasporeda...</div>

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Raspored rada</div>
        <div className={styles.headerActions}>
          {isAdmin && (
            <>
              <button className={styles.btnSecondary} onClick={copyPrevWeek}>
                ↩ Kopiraj prethodnu sedmicu
              </button>
              <button className={styles.btnAdd} onClick={() => openForm()}>
                + Dodaj smjenu
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigacija sedmicom */}
      <div className={styles.weekNav}>
        <button className={styles.weekBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
        <div className={styles.weekLabel}>
          {fmtDisplay(weekDates[0])} — {fmtDisplay(weekDates[6])}
          {weekOffset === 0 && <span className={styles.weekCurrent}>Ova sedmica</span>}
          {weekOffset === 1 && <span className={styles.weekCurrent}>Sljedeća sedmica</span>}
          {weekOffset === -1 && <span className={styles.weekCurrent}>Prethodna sedmica</span>}
        </div>
        <button className={styles.weekBtn} onClick={() => setWeekOffset(w => w + 1)}>›</button>
        {weekOffset !== 0 && (
          <button className={styles.weekToday} onClick={() => setWeekOffset(0)}>Danas</button>
        )}
      </div>

      {/* Grid raspored */}
      {staff.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <div>Nema aktivnog osoblja. Dodajte zaposlenike u modulu Osoblje.</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Header row */}
          <div className={styles.gridHeader}>
            <div className={styles.gridStaffCol}>Zaposlenik</div>
            {weekDates.map((date, i) => {
              const isToday = fmt(date) === fmt(new Date())
              return (
                <div key={i} className={`${styles.gridDayCol} ${isToday ? styles.gridDayToday : ''}`}>
                  <div className={styles.gridDayName}>{DAYS[i]}</div>
                  <div className={styles.gridDayDate}>{fmtDisplay(date)}</div>
                </div>
              )
            })}
          </div>

          {/* Staff rows */}
          {staff.map((member, memberIdx) => (
            <div key={member.id} className={styles.gridRow}>
              <div className={styles.gridStaffCell}>
                <div
                  className={styles.staffDot}
                  style={{ background: staffColor(memberIdx) }}
                />
                <span className={styles.staffName}>{staffName(member)}</span>
              </div>
              {weekDates.map((date, dayIdx) => {
                const dateStr = fmt(date)
                const sch = getSchedule(member.id, dateStr)
                const isToday = dateStr === fmt(new Date())
                return (
                  <div
                    key={dayIdx}
                    className={`${styles.gridCell} ${isToday ? styles.gridCellToday : ''} ${isAdmin ? styles.gridCellClickable : ''}`}
                    onClick={() => isAdmin && openForm(member.id, dateStr, sch || null)}
                  >
                    {sch ? (
                      <div
                        className={`${styles.shift} ${styles[`status-${sch.status}`]}`}
                        style={{ borderLeftColor: staffColor(memberIdx) }}
                      >
                        <div className={styles.shiftTime}>
                          {sch.start_time.slice(0, 5)}–{sch.end_time.slice(0, 5)}
                        </div>
                        {sch.note && <div className={styles.shiftNote}>{sch.note}</div>}
                      </div>
                    ) : (
                      isAdmin && <div className={styles.cellEmpty}>+</div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Modal forma */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {editSchedule ? 'Uredi smjenu' : 'Nova smjena'}
              </div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={saveSchedule} className={styles.form}>
              <div className={styles.field}>
                <label>Zaposlenik *</label>
                <select
                  value={form.staff_id}
                  onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  required
                >
                  <option value="">— Odaberi —</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{staffName(s)}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Datum *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Početak *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Kraj *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {form.start_time && form.end_time && (
                <div className={styles.shiftDuration}>
                  Trajanje: {(() => {
                    const [sh, sm] = form.start_time.split(':').map(Number)
                    const [eh, em] = form.end_time.split(':').map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    return mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : '—'
                  })()}
                </div>
              )}

              <div className={styles.field}>
                <label>Napomena</label>
                <input
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Npr. vikend smjena, zamjena..."
                />
              </div>

              <div className={styles.modalActions}>
                {editSchedule && (
                  <button
                    type="button"
                    className={styles.btnDelete}
                    onClick={() => deleteSchedule(editSchedule.id)}
                  >
                    Obriši smjenu
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>
                  Odustani
                </button>
                <button type="submit" className={styles.btnAdd} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
