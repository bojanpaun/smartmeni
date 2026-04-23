// ▶ Zamijeniti: src/modules/hr/pages/AttendancePage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './AttendancePage.module.css'

const toDay = () => new Date().toISOString().slice(0, 10)

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })
}

function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null
  const diff = (new Date(clockOut) - new Date(clockIn)) / 3600000
  return diff > 0 ? parseFloat(diff.toFixed(2)) : null
}

function totalHoursForDay(entries) {
  return entries.reduce((s, e) => s + (parseFloat(e.hours_worked) || 0), 0)
}

export default function AttendancePage() {
  const { restaurant, user, isOwner, isSuperAdmin } = usePlatform()
  const isAdmin = isOwner() || isSuperAdmin()

  const [staff, setStaff] = useState([])
  const [entriesByStaff, setEntriesByStaff] = useState({})
  const [myStaffRecord, setMyStaffRecord] = useState(null)
  const [myEntries, setMyEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(toDay())
  const [clockSaving, setClockSaving] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (restaurant && user) loadData()
  }, [restaurant, user, filterDate])

  const loadData = async () => {
    setLoading(true)
    const [{ data: s }, { data: myStaff }] = await Promise.all([
      supabase.from('staff').select('id, email, user_profiles(full_name)')
        .eq('restaurant_id', restaurant.id).eq('is_active', true).order('email'),
      supabase.from('staff').select('id')
        .eq('restaurant_id', restaurant.id).eq('user_id', user.id).single(),
    ])
    setStaff(s || [])

    const { data: entries } = await supabase.from('attendance_entries')
      .select('*').eq('restaurant_id', restaurant.id)
      .eq('date', filterDate).order('clock_in')

    const grouped = {}
    ;(entries || []).forEach(e => {
      if (!grouped[e.staff_id]) grouped[e.staff_id] = []
      grouped[e.staff_id].push(e)
    })
    setEntriesByStaff(grouped)

    if (myStaff) {
      setMyStaffRecord(myStaff)
      if (filterDate === toDay()) {
        setMyEntries(grouped[myStaff.id] || [])
      } else {
        const { data: todayEntries } = await supabase.from('attendance_entries')
          .select('*').eq('staff_id', myStaff.id).eq('date', toDay()).order('clock_in')
        setMyEntries(todayEntries || [])
      }
    }
    setLoading(false)
  }

  const clockIn = async () => {
    if (!myStaffRecord) return
    setClockSaving(true)
    const { data } = await supabase.from('attendance_entries').insert({
      restaurant_id: restaurant.id,
      staff_id: myStaffRecord.id,
      date: toDay(),
      clock_in: new Date().toISOString(),
    }).select().single()
    setMyEntries(prev => [...prev, data])
    if (filterDate === toDay()) {
      setEntriesByStaff(prev => ({
        ...prev,
        [myStaffRecord.id]: [...(prev[myStaffRecord.id] || []), data],
      }))
    }
    setClockSaving(false)
  }

  const clockOut = async (entryId) => {
    setClockSaving(true)
    const entry = myEntries.find(e => e.id === entryId)
    if (!entry) { setClockSaving(false); return }
    const now = new Date().toISOString()
    const hours = calcHours(entry.clock_in, now)
    const { data } = await supabase.from('attendance_entries')
      .update({ clock_out: now, hours_worked: hours }).eq('id', entryId).select().single()
    setMyEntries(prev => prev.map(e => e.id === entryId ? data : e))
    if (filterDate === toDay()) {
      setEntriesByStaff(prev => ({
        ...prev,
        [myStaffRecord.id]: (prev[myStaffRecord.id] || []).map(e => e.id === entryId ? data : e),
      }))
    }
    setClockSaving(false)
  }

  const openEdit = (entry) => {
    setEditEntry(entry)
    const toLocalTime = (ts) => {
      if (!ts) return ''
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    setEditForm({ clock_in: toLocalTime(entry.clock_in), clock_out: toLocalTime(entry.clock_out), note: entry.note || '' })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const base = filterDate + 'T'
    const ci = editForm.clock_in ? new Date(base + editForm.clock_in).toISOString() : null
    const co = editForm.clock_out ? new Date(base + editForm.clock_out).toISOString() : null
    const hours = calcHours(ci, co)
    await supabase.from('attendance_entries').update({
      clock_in: ci, clock_out: co, hours_worked: hours, note: editForm.note || null,
    }).eq('id', editEntry.id)
    setEntriesByStaff(prev => {
      const updated = {}
      Object.keys(prev).forEach(sid => {
        updated[sid] = prev[sid].map(e => e.id === editEntry.id
          ? { ...e, clock_in: ci, clock_out: co, hours_worked: hours, note: editForm.note } : e)
      })
      return updated
    })
    setSaving(false)
    setEditEntry(null)
  }

  const deleteEntry = async (entryId, staffId) => {
    if (!confirm('Obrisati ovaj unos?')) return
    await supabase.from('attendance_entries').delete().eq('id', entryId)
    setEntriesByStaff(prev => ({
      ...prev,
      [staffId]: (prev[staffId] || []).filter(e => e.id !== entryId),
    }))
    if (myStaffRecord?.id === staffId) setMyEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const addManualEntry = async (staffId) => {
    const { data } = await supabase.from('attendance_entries').insert({
      restaurant_id: restaurant.id,
      staff_id: staffId,
      date: filterDate,
      clock_in: new Date(filterDate + 'T08:00:00').toISOString(),
    }).select().single()
    setEntriesByStaff(prev => ({
      ...prev,
      [staffId]: [...(prev[staffId] || []), data],
    }))
    openEdit(data)
  }

  const staffName = (s) => s?.user_profiles?.full_name || s?.email?.split('@')[0] || '—'
  const activeEntry = myEntries.find(e => e.clock_in && !e.clock_out)
  const todayHours = totalHoursForDay(myEntries)

  if (loading) return <div className={styles.loading}>Učitavanje evidencije...</div>

  return (
    <div className={styles.wrap}>

      {/* Clock in/out za zaposlenika */}
      {myStaffRecord && (
        <div className={styles.clockCard}>
          <div className={styles.clockTop}>
            <div>
              <div className={styles.clockTitle}>Moje smjene danas</div>
              {todayHours > 0 && (
                <div className={styles.clockTotalHours}>
                  Ukupno: <strong>{todayHours.toFixed(1)}h</strong>
                </div>
              )}
            </div>
            <div className={styles.clockBtns}>
              {!activeEntry ? (
                <button className={styles.btnClockIn} onClick={clockIn} disabled={clockSaving}>
                  {clockSaving ? '...' : '▶ Prijavi se'}
                </button>
              ) : (
                <button className={styles.btnClockOut} onClick={() => clockOut(activeEntry.id)} disabled={clockSaving}>
                  {clockSaving ? '...' : '⏹ Odjavi se'}
                </button>
              )}
              {/* Nova smjena ako je prethodna završena */}
              {myEntries.length > 0 && !activeEntry && (
                <button className={styles.btnNewShift} onClick={clockIn} disabled={clockSaving}>
                  + Nova smjena
                </button>
              )}
            </div>
          </div>
          {myEntries.length > 0 && (
            <div className={styles.myShifts}>
              {myEntries.map((entry, i) => (
                <div key={entry.id} className={`${styles.myShift} ${!entry.clock_out ? styles.myShiftActive : ''}`}>
                  <span className={styles.myShiftNum}>Smjena {i + 1}</span>
                  <span className={styles.myShiftTime}>
                    {fmtTime(entry.clock_in)} → {entry.clock_out
                      ? fmtTime(entry.clock_out)
                      : <span className={styles.myShiftLive}>u toku</span>}
                  </span>
                  {entry.hours_worked && (
                    <span className={styles.myShiftHours}>{parseFloat(entry.hours_worked).toFixed(1)}h</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin panel */}
      {isAdmin && (
        <>
          <div className={styles.header}>
            <div className={styles.headerTitle}>Evidencija dolazaka</div>
            <input type="date" className={styles.dateFilter} value={filterDate}
              onChange={e => setFilterDate(e.target.value)} />
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Prisutni</div>
              <div className={styles.statVal}>{staff.filter(s => (entriesByStaff[s.id] || []).length > 0).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Odsutni</div>
              <div className={styles.statVal}>{staff.filter(s => (entriesByStaff[s.id] || []).length === 0).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Aktivne smjene</div>
              <div className={styles.statVal}>{Object.values(entriesByStaff).flat().filter(e => !e.clock_out).length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Ukupno sati</div>
              <div className={styles.statVal}>
                {Object.values(entriesByStaff).flat()
                  .reduce((s, e) => s + (parseFloat(e.hours_worked) || 0), 0).toFixed(1)}h
              </div>
            </div>
          </div>

          <div className={styles.list}>
            {staff.map(member => {
              const entries = entriesByStaff[member.id] || []
              const totalH = totalHoursForDay(entries)
              const hasActive = entries.some(e => !e.clock_out)

              return (
                <div key={member.id} className={styles.staffSection}>
                  <div className={styles.staffSectionHeader}>
                    <div className={styles.staffSectionName}>
                      <div className={styles.staffAvatar}>{staffName(member)[0].toUpperCase()}</div>
                      {staffName(member)}
                      {hasActive && <span className={styles.activeBadge}>● Aktivan</span>}
                    </div>
                    <div className={styles.staffSectionMeta}>
                      {totalH > 0 && <span className={styles.staffTotalH}>{totalH.toFixed(1)}h</span>}
                      {entries.length === 0 && <span className={styles.absentBadge}>Odsutan</span>}
                      <button className={styles.btnAddEntry} onClick={() => addManualEntry(member.id)}>+ Unos</button>
                    </div>
                  </div>
                  {entries.length > 0 && (
                    <div className={styles.entriesList}>
                      {entries.map((entry, i) => (
                        <div key={entry.id} className={`${styles.entryRow} ${!entry.clock_out ? styles.entryRowActive : ''}`}>
                          <span className={styles.entryNum}>#{i + 1}</span>
                          <span className={styles.entryTimes}>
                            {fmtTime(entry.clock_in)}
                            <span className={styles.entryArrow}>→</span>
                            {entry.clock_out ? fmtTime(entry.clock_out) : <span className={styles.liveDot}>u toku</span>}
                          </span>
                          {entry.hours_worked && <span className={styles.entryHours}>{parseFloat(entry.hours_worked).toFixed(1)}h</span>}
                          {entry.note && <span className={styles.entryNote}>{entry.note}</span>}
                          <div className={styles.entryActions}>
                            <button className={styles.btnEdit} onClick={() => openEdit(entry)}>Uredi</button>
                            <button className={styles.btnDel} onClick={() => deleteEntry(entry.id, member.id)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edit modal */}
      {editEntry && (
        <div className={styles.overlay} onClick={() => setEditEntry(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Uredi unos</div>
              <button className={styles.modalClose} onClick={() => setEditEntry(null)}>✕</button>
            </div>
            <form onSubmit={saveEdit} className={styles.form}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Prijava *</label>
                  <input type="time" value={editForm.clock_in}
                    onChange={e => setEditForm(f => ({ ...f, clock_in: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>Odjava</label>
                  <input type="time" value={editForm.clock_out}
                    onChange={e => setEditForm(f => ({ ...f, clock_out: e.target.value }))} />
                </div>
              </div>
              {editForm.clock_in && editForm.clock_out && (
                <div className={styles.calcHours}>
                  ≈ {calcHours(filterDate + 'T' + editForm.clock_in, filterDate + 'T' + editForm.clock_out)?.toFixed(1) || '—'}h
                </div>
              )}
              <div className={styles.field}>
                <label>Napomena</label>
                <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Razlog korekcije..." />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEditEntry(null)}>Odustani</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
