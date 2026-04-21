// ▶ Novi fajl: src/modules/hr/pages/AttendancePage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AttendancePage.module.css'

const today = () => new Date().toISOString().slice(0, 10)

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })
}

function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const diff = (new Date(clockOut) - new Date(clockIn)) / 3600000
  return diff > 0 ? diff : null
}

export default function AttendancePage() {
  const { restaurant, user, isOwner, isSuperAdmin } = usePlatform()
  const isAdmin = isOwner() || isSuperAdmin()

  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [myStaffRecord, setMyStaffRecord] = useState(null)
  const [myToday, setMyToday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(today())
  const [editRecord, setEditRecord] = useState(null)
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [clockSaving, setClockSaving] = useState(false)

  useEffect(() => {
    if (restaurant && user) loadData()
  }, [restaurant, user, filterDate])

  const loadData = async () => {
    setLoading(true)
    const [{ data: s }, { data: att }, { data: myStaff }] = await Promise.all([
      supabase.from('staff').select('id, email, user_profiles(full_name)')
        .eq('restaurant_id', restaurant.id).eq('is_active', true).order('email'),
      supabase.from('attendance').select('*, staff(email, user_profiles(full_name))')
        .eq('restaurant_id', restaurant.id).eq('date', filterDate).order('clock_in'),
      supabase.from('staff').select('id').eq('restaurant_id', restaurant.id).eq('user_id', user.id).single(),
    ])
    setStaff(s || [])
    setAttendance(att || [])

    if (myStaff) {
      setMyStaffRecord(myStaff)
      const { data: todayAtt } = await supabase.from('attendance')
        .select('*').eq('staff_id', myStaff.id).eq('date', today()).single()
      setMyToday(todayAtt || null)
    }
    setLoading(false)
  }

  // ── Clock in ──────────────────────────────────────────────
  const clockIn = async () => {
    if (!myStaffRecord) return
    setClockSaving(true)
    const now = new Date().toISOString()

    // Nađi raspored za danas
    const { data: schedule } = await supabase.from('work_schedules')
      .select('start_time, end_time').eq('staff_id', myStaffRecord.id).eq('date', today()).single()

    const payload = {
      restaurant_id: restaurant.id,
      staff_id: myStaffRecord.id,
      date: today(),
      clock_in: now,
      planned_start: schedule?.start_time || null,
      planned_end: schedule?.end_time || null,
      status: 'present',
    }

    const { data } = await supabase.from('attendance').upsert(payload, { onConflict: 'staff_id,date' }).select().single()
    setMyToday(data)
    if (filterDate === today()) setAttendance(prev => {
      const filtered = prev.filter(a => a.staff_id !== myStaffRecord.id)
      return [...filtered, { ...data, staff: { email: user.email } }]
    })
    setClockSaving(false)
  }

  // ── Clock out ─────────────────────────────────────────────
  const clockOut = async () => {
    if (!myToday) return
    setClockSaving(true)
    const now = new Date().toISOString()
    const hours = calcHours(myToday.clock_in, now)

    const { data } = await supabase.from('attendance').update({
      clock_out: now,
      hours_worked: hours,
      status: 'present',
    }).eq('id', myToday.id).select().single()

    setMyToday(data)
    setAttendance(prev => prev.map(a => a.id === data.id ? { ...a, ...data } : a))
    setClockSaving(false)
  }

  // ── Admin korekcija ───────────────────────────────────────
  const openEdit = (record) => {
    setEditRecord(record)
    const toLocalTime = (ts) => {
      if (!ts) return ''
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    setEditForm({
      clock_in: toLocalTime(record.clock_in),
      clock_out: toLocalTime(record.clock_out),
      note: record.note || '',
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const base = filterDate + 'T'
    const clockIn = editForm.clock_in ? new Date(base + editForm.clock_in).toISOString() : null
    const clockOut = editForm.clock_out ? new Date(base + editForm.clock_out).toISOString() : null
    const hours = calcHours(clockIn, clockOut)

    await supabase.from('attendance').update({
      clock_in: clockIn,
      clock_out: clockOut,
      hours_worked: hours,
      note: editForm.note || null,
    }).eq('id', editRecord.id)

    setAttendance(prev => prev.map(a => a.id === editRecord.id
      ? { ...a, clock_in: clockIn, clock_out: clockOut, hours_worked: hours, note: editForm.note }
      : a
    ))
    setSaving(false)
    setEditRecord(null)
  }

  const addManual = async (staffId) => {
    const { data } = await supabase.from('attendance').upsert({
      restaurant_id: restaurant.id,
      staff_id: staffId,
      date: filterDate,
      status: 'present',
    }, { onConflict: 'staff_id,date' }).select('*, staff(email, user_profiles(full_name))').single()
    setAttendance(prev => {
      const filtered = prev.filter(a => a.staff_id !== staffId)
      return [...filtered, data]
    })
    openEdit(data)
  }

  const staffName = (s) => s?.user_profiles?.full_name || s?.email?.split('@')[0] || '—'
  const isLate = (record) => {
    if (!record.planned_start || !record.clock_in) return false
    const planned = new Date(filterDate + 'T' + record.planned_start)
    const actual = new Date(record.clock_in)
    return actual - planned > 10 * 60 * 1000 // >10 min kasni
  }

  if (loading) return <div className={styles.loading}>Učitavanje evidencije...</div>

  return (
    <div className={styles.wrap}>

      {/* Clock in/out za zaposlenika */}
      {myStaffRecord && (
        <div className={styles.clockCard}>
          <div className={styles.clockTitle}>Moja smjena danas</div>
          <div className={styles.clockInfo}>
            {myToday?.clock_in && (
              <span>Prijava: <strong>{fmtTime(myToday.clock_in)}</strong></span>
            )}
            {myToday?.clock_out && (
              <span>Odjava: <strong>{fmtTime(myToday.clock_out)}</strong></span>
            )}
            {myToday?.hours_worked && (
              <span>Sati: <strong>{parseFloat(myToday.hours_worked).toFixed(1)}h</strong></span>
            )}
          </div>
          <div className={styles.clockActions}>
            {!myToday?.clock_in && (
              <button className={styles.btnClockIn} onClick={clockIn} disabled={clockSaving}>
                {clockSaving ? '...' : '▶ Prijavi dolazak'}
              </button>
            )}
            {myToday?.clock_in && !myToday?.clock_out && (
              <button className={styles.btnClockOut} onClick={clockOut} disabled={clockSaving}>
                {clockSaving ? '...' : '⏹ Odjavi odlazak'}
              </button>
            )}
            {myToday?.clock_out && (
              <div className={styles.clockDone}>✓ Smjena završena</div>
            )}
          </div>
        </div>
      )}

      {/* Admin panel */}
      {isAdmin && (
        <>
          <div className={styles.header}>
            <div className={styles.headerTitle}>Evidencija dolazaka</div>
            <input
              type="date"
              className={styles.dateFilter}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>

          {/* Statistika za dan */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Prisutni</div>
              <div className={styles.statVal}>{attendance.filter(a => a.clock_in).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Odsutni</div>
              <div className={styles.statVal}>{staff.length - attendance.filter(a => a.clock_in).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Kasni</div>
              <div className={styles.statVal}>{attendance.filter(isLate).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Ukupno sati</div>
              <div className={styles.statVal}>
                {attendance.reduce((s, a) => s + (parseFloat(a.hours_worked) || 0), 0).toFixed(1)}h
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className={styles.list}>
            {staff.map(member => {
              const rec = attendance.find(a => a.staff_id === member.id)
              return (
                <div key={member.id} className={`${styles.attRow} ${rec?.clock_in ? styles.attRowPresent : styles.attRowAbsent}`}>
                  <div className={styles.attName}>{staffName(member)}</div>
                  <div className={styles.attStatus}>
                    {rec?.clock_in ? (
                      <span className={`${styles.pill} ${isLate(rec) ? styles.pillLate : styles.pillPresent}`}>
                        {isLate(rec) ? 'Kasni' : 'Prisutan'}
                      </span>
                    ) : (
                      <span className={`${styles.pill} ${styles.pillAbsent}`}>Odsutan</span>
                    )}
                  </div>
                  <div className={styles.attTimes}>
                    {rec?.clock_in && <span>▶ {fmtTime(rec.clock_in)}</span>}
                    {rec?.planned_start && <span className={styles.planned}>(plan: {rec.planned_start.slice(0,5)})</span>}
                    {rec?.clock_out && <span>⏹ {fmtTime(rec.clock_out)}</span>}
                  </div>
                  <div className={styles.attHours}>
                    {rec?.hours_worked ? `${parseFloat(rec.hours_worked).toFixed(1)}h` : '—'}
                  </div>
                  <div className={styles.attActions}>
                    {rec ? (
                      <button className={styles.btnEdit} onClick={() => openEdit(rec)}>Korekcija</button>
                    ) : (
                      <button className={styles.btnAdd2} onClick={() => addManual(member.id)}>+ Dodaj</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edit modal */}
      {editRecord && (
        <div className={styles.overlay} onClick={() => setEditRecord(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Korekcija dolaska</div>
              <button className={styles.modalClose} onClick={() => setEditRecord(null)}>✕</button>
            </div>
            <form onSubmit={saveEdit} className={styles.form}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Prijava</label>
                  <input type="time" value={editForm.clock_in} onChange={e => setEditForm(f => ({ ...f, clock_in: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>Odjava</label>
                  <input type="time" value={editForm.clock_out} onChange={e => setEditForm(f => ({ ...f, clock_out: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Napomena</label>
                <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Razlog korekcije..." />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEditRecord(null)}>Odustani</button>
                <button type="submit" className={styles.btnAdd} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
