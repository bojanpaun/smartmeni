// ▶ Zamijeniti: src/modules/hr/pages/SchedulePage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './SchedulePage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']
const STAFF_COLORS = ['#0d7a52','#378add','#7f77dd','#d85a30','#d4537e','#1d9e75','#ba7517','#993556']
const STAFF_COLORS_LIGHT = ['#E1F5EE','#E6F1FB','#EEEDFE','#FAECE7','#FBEAF0','#E1F5EE','#FAEEDA','#FBEAF0']
const STAFF_COLORS_TEXT = ['#085041','#0C447C','#3C3489','#712B13','#72243E','#085041','#633806','#72243E']

const HOUR_START = 6
const HOUR_END = 23
const TOTAL_HOURS = HOUR_END - HOUR_START

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - day + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
}

function fmt(date) { return date.toISOString().slice(0, 10) }
function fmtDisplay(date) { return date.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' }) }
function fmtDisplayFull(date) { return date.toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }) }

function timeToPercent(timeStr) {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number)
  return Math.max(0, Math.min(100, ((h + m / 60 - HOUR_START) / TOTAL_HOURS) * 100))
}

function timeDiffHours(start, end) {
  const [sh, sm] = start.slice(0, 5).split(':').map(Number)
  const [eh, em] = end.slice(0, 5).split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

export default function SchedulePage() {
  const { restaurant, isOwner, isSuperAdmin } = usePlatform()
  const isAdmin = isOwner() || isSuperAdmin()

  const [staff, setStaff] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [dayOffset, setDayOffset] = useState(0)
  const [view, setView] = useState('week')
  const [showForm, setShowForm] = useState(false)
  const [editSchedule, setEditSchedule] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ staff_id: '', date: '', start_time: '08:00', end_time: '16:00', note: '' })

  const weekDates = getWeekDates(weekOffset)
  const weekStart = fmt(weekDates[0])
  const weekEnd = fmt(weekDates[6])

  const today = new Date()
  const currentDay = new Date(today)
  currentDay.setDate(today.getDate() + dayOffset)
  const currentDayStr = fmt(currentDay)

  useEffect(() => { if (restaurant) loadData() }, [restaurant, weekOffset])

  useEffect(() => {
    if (restaurant && view === 'day') loadDayData(currentDayStr)
  }, [dayOffset, view, restaurant])

  const loadData = async () => {
    setLoading(true)
    const [{ data: s }, { data: sch }] = await Promise.all([
      supabase.from('staff').select('id, email, first_name, last_name, avatar_url')
        .eq('restaurant_id', restaurant.id).eq('is_active', true).order('email'),
      supabase.from('work_schedules').select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('date', weekStart).lte('date', weekEnd),
    ])
    setStaff(s || [])
    setSchedules(sch || [])
    setLoading(false)
  }

  const loadDayData = async (dateStr) => {
    const { data: sch } = await supabase.from('work_schedules').select('*')
      .eq('restaurant_id', restaurant.id).eq('date', dateStr)
    if (sch) setSchedules(prev => [...prev.filter(s => s.date !== dateStr), ...sch])
  }

  const getShifts = (staffId, date) =>
    schedules.filter(s => s.staff_id === staffId && s.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const openForm = (staffId = '', date = '', existing = null) => {
    if (existing) {
      setEditSchedule(existing)
      setForm({ staff_id: existing.staff_id, date: existing.date, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5), note: existing.note || '' })
    } else {
      setEditSchedule(null)
      setForm({ staff_id: staffId, date, start_time: '08:00', end_time: '16:00', note: '' })
    }
    setShowForm(true)
  }

  const saveSchedule = async (e) => {
    e.preventDefault(); setSaving(true)
    const payload = { restaurant_id: restaurant.id, staff_id: form.staff_id, date: form.date, start_time: form.start_time, end_time: form.end_time, note: form.note || null, status: 'scheduled' }
    if (editSchedule) {
      await supabase.from('work_schedules').update(payload).eq('id', editSchedule.id)
      setSchedules(prev => prev.map(s => s.id === editSchedule.id ? { ...s, ...payload } : s))
    } else {
      const { data } = await supabase.from('work_schedules').insert(payload).select().single()
      if (data) setSchedules(prev => [...prev, data])
    }
    setSaving(false); setShowForm(false)
  }

  const deleteSchedule = async (id) => {
    await supabase.from('work_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    setShowForm(false)
  }

  const copyPrevWeek = async () => {
    if (!confirm('Kopirati raspored iz prethodne sedmice?')) return
    const prevDates = getWeekDates(weekOffset - 1)
    const { data: prev } = await supabase.from('work_schedules').select('*')
      .eq('restaurant_id', restaurant.id).gte('date', fmt(prevDates[0])).lte('date', fmt(prevDates[6]))
    if (!prev?.length) { alert('Nema rasporeda u prethodnoj sedmici.'); return }
    const newSchedules = prev.map(s => {
      const nd = new Date(s.date); nd.setDate(nd.getDate() + 7)
      return { restaurant_id: restaurant.id, staff_id: s.staff_id, date: fmt(nd), start_time: s.start_time, end_time: s.end_time, note: s.note, status: 'scheduled' }
    })
    await supabase.from('work_schedules').insert(newSchedules)
    loadData()
  }

  const staffName = (s) => (s.first_name && s.last_name) ? `${s.first_name} ${s.last_name}` : s.email.split('@')[0]
  const staffColor = (idx) => STAFF_COLORS[idx % STAFF_COLORS.length]
  const staffColorLight = (idx) => STAFF_COLORS_LIGHT[idx % STAFF_COLORS_LIGHT.length]
  const staffColorText = (idx) => STAFF_COLORS_TEXT[idx % STAFF_COLORS_TEXT.length]

  const getCoverageGaps = (dateStr) => {
    const allShifts = schedules.filter(s => s.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time))
    if (!allShifts.length) return []
    const gaps = []
    let covered = allShifts[0].start_time
    for (const sh of allShifts) {
      if (sh.start_time > covered) gaps.push({ start: covered, end: sh.start_time })
      if (sh.end_time > covered) covered = sh.end_time
    }
    return gaps
  }

  if (loading) return <div className={styles.loading}>Učitavanje rasporeda...</div>

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <h1 className={gsStyles.title} style={{ margin: 0 }}>Raspored rada</h1>
        <p className={gsStyles.subtitle}>Planiranje i pregled smjena osoblja.</p>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'week' ? styles.viewBtnActive : ''}`} onClick={() => setView('week')}>Sedmica</button>
            <button className={`${styles.viewBtn} ${view === 'day' ? styles.viewBtnActive : ''}`} onClick={() => setView('day')}>Dan</button>
          </div>
          {isAdmin && <>
            {view === 'week' && <button className={styles.btnSecondary} onClick={copyPrevWeek}>↩ Kopiraj prethodnu sedmicu</button>}
            <button className={styles.btnAdd} onClick={() => openForm('', view === 'day' ? currentDayStr : '')}>+ Dodaj smjenu</button>
          </>}
        </div>
      </div>

      {/* SEDMIČNI VIEW */}
      {view === 'week' && (<>
        <div className={styles.weekNav}>
          <button className={styles.weekBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
          <div className={styles.weekLabel}>
            {fmtDisplay(weekDates[0])} — {fmtDisplay(weekDates[6])}
            {weekOffset === 0 && <span className={styles.weekCurrent}>Ova sedmica</span>}
            {weekOffset === 1 && <span className={styles.weekCurrent}>Sljedeća sedmica</span>}
            {weekOffset === -1 && <span className={styles.weekCurrent}>Prethodna sedmica</span>}
          </div>
          <button className={styles.weekBtn} onClick={() => setWeekOffset(w => w + 1)}>›</button>
          {weekOffset !== 0 && <button className={styles.weekToday} onClick={() => setWeekOffset(0)}>Danas</button>}
        </div>

        {staff.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyIcon}>👥</div><div>Nema aktivnog osoblja.</div></div>
        ) : (
          <div className={styles.grid}>
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
            {staff.map((member, memberIdx) => (
              <div key={member.id} className={styles.gridRow}>
                <div className={styles.gridStaffCell}>
                  <div className={styles.staffDot} style={{ background: staffColor(memberIdx) }} />
                  <span className={styles.staffName}>{staffName(member)}</span>
                </div>
                {weekDates.map((date, dayIdx) => {
                  const dateStr = fmt(date)
                  const isToday = dateStr === fmt(new Date())
                  const shifts = getShifts(member.id, dateStr)
                  return (
                    <div key={dayIdx} className={`${styles.gridCell} ${isToday ? styles.gridCellToday : ''}`}>
                      <div className={styles.cellShifts}>
                        {shifts.map(sch => (
                          <div key={sch.id} className={styles.shift} style={{ borderLeftColor: staffColor(memberIdx) }}
                            onClick={() => isAdmin && openForm(member.id, dateStr, sch)}>
                            <div className={styles.shiftTime}>{sch.start_time.slice(0, 5)}–{sch.end_time.slice(0, 5)}</div>
                            {sch.note && <div className={styles.shiftNote}>{sch.note}</div>}
                          </div>
                        ))}
                        {isAdmin && <div className={styles.cellEmpty} onClick={() => openForm(member.id, dateStr)}>+</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* DNEVNI VIEW */}
      {view === 'day' && (<>
        <div className={styles.weekNav}>
          <button className={styles.weekBtn} onClick={() => setDayOffset(d => d - 1)}>‹</button>
          <div className={styles.weekLabel}>
            <span style={{ textTransform: 'capitalize' }}>{fmtDisplayFull(currentDay)}</span>
            {dayOffset === 0 && <span className={styles.weekCurrent}>Danas</span>}
          </div>
          <button className={styles.weekBtn} onClick={() => setDayOffset(d => d + 1)}>›</button>
          {dayOffset !== 0 && <button className={styles.weekToday} onClick={() => setDayOffset(0)}>Danas</button>}
        </div>

        {staff.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyIcon}>👥</div><div>Nema aktivnog osoblja.</div></div>
        ) : (
          <div className={styles.timeline}>
            <div className={styles.tlStaffCol}>
              <div className={styles.tlStaffHeader}></div>
              {staff.map((member, idx) => (
                <div key={member.id} className={styles.tlStaffRow}>
                  <div className={styles.staffDot} style={{ background: staffColor(idx) }} />
                  <span className={styles.tlStaffName}>{staffName(member)}</span>
                </div>
              ))}
              <div className={styles.tlCoverageLabel}>Pokrivenost</div>
            </div>

            <div className={styles.tlChartArea}>
              <div className={styles.tlTimeHeader}>
                {hours.map(h => (
                  <div key={h} className={styles.tlTimeTick}>{String(h).padStart(2, '0')}:00</div>
                ))}
              </div>

              {staff.map((member, idx) => {
                const shifts = getShifts(member.id, currentDayStr)
                const totalH = shifts.reduce((sum, s) => sum + timeDiffHours(s.start_time, s.end_time), 0)
                return (
                  <div key={member.id} className={styles.tlRow}>
                    {hours.map(h => (
                      <div key={h} className={styles.tlHourLine} style={{ left: `${((h - HOUR_START) / TOTAL_HOURS) * 100}%` }} />
                    ))}
                    {shifts.map(sch => {
                      const left = timeToPercent(sch.start_time)
                      const width = Math.max(1, timeToPercent(sch.end_time) - left)
                      return (
                        <div key={sch.id} className={styles.tlShiftBar}
                          style={{ left: `${left}%`, width: `${width}%`, background: staffColorLight(idx), color: staffColorText(idx), borderLeft: `3px solid ${staffColor(idx)}` }}
                          onClick={() => isAdmin && openForm(member.id, currentDayStr, sch)}
                          title={`${sch.start_time.slice(0,5)}–${sch.end_time.slice(0,5)}`}
                        >
                          {width > 7 && `${sch.start_time.slice(0,5)}–${sch.end_time.slice(0,5)}`}
                        </div>
                      )
                    })}
                    {totalH > 0 && <div className={styles.tlTotalBadge}>{totalH.toFixed(1)}h</div>}
                    {isAdmin && <div className={styles.tlAddBtn} onClick={() => openForm(member.id, currentDayStr)}>+</div>}
                  </div>
                )
              })}

              <div className={styles.tlCoverageRow}>
                {hours.map(h => (
                  <div key={h} className={styles.tlHourLine} style={{ left: `${((h - HOUR_START) / TOTAL_HOURS) * 100}%` }} />
                ))}
                {(() => {
                  const allShifts = schedules.filter(s => s.date === currentDayStr)
                  if (!allShifts.length) return <div className={styles.tlNoCoverage}>Nema smjena za ovaj dan</div>
                  const sorted = [...allShifts].sort((a, b) => a.start_time.localeCompare(b.start_time))
                  const minStart = sorted[0].start_time
                  const maxEnd = sorted.reduce((m, s) => s.end_time > m ? s.end_time : m, sorted[0].end_time)
                  const covLeft = timeToPercent(minStart)
                  const covWidth = timeToPercent(maxEnd) - covLeft
                  const gaps = getCoverageGaps(currentDayStr)
                  return (<>
                    <div className={styles.tlCovBar} style={{ left: `${covLeft}%`, width: `${covWidth}%` }} />
                    {gaps.map((g, i) => {
                      const gl = timeToPercent(g.start)
                      const gw = timeToPercent(g.end) - gl
                      return <div key={i} className={styles.tlGapBar} style={{ left: `${gl}%`, width: `${gw}%` }} title={`Nepokriveno: ${g.start.slice(0,5)}–${g.end.slice(0,5)}`} />
                    })}
                  </>)
                })()}
              </div>
            </div>
          </div>
        )}

        <div className={styles.tlLegend}>
          <div className={styles.tlLegendItem}><div className={styles.tlLegendDot} style={{ background: '#E1F5EE', border: '1px solid #5DCAA5' }}></div>Smjena</div>
          <div className={styles.tlLegendItem}><div className={styles.tlLegendDot} style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}></div>Nepokriveni period</div>
        </div>
      </>)}

      {/* Modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editSchedule ? 'Uredi smjenu' : 'Nova smjena'}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveSchedule} className={styles.form}>
              <div className={styles.field}>
                <label>Zaposlenik *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} required>
                  <option value="">— Odaberi —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Datum *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Početak *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>Kraj *</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              {form.start_time && form.end_time && (() => {
                const [sh, sm] = form.start_time.split(':').map(Number)
                const [eh, em] = form.end_time.split(':').map(Number)
                const mins = (eh * 60 + em) - (sh * 60 + sm)
                return mins > 0 ? <div className={styles.shiftDuration}>Trajanje: {Math.floor(mins / 60)}h {mins % 60}min</div> : null
              })()}
              <div className={styles.field}>
                <label>Napomena</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Npr. vikend smjena, zamjena..." />
              </div>
              <div className={styles.modalActions}>
                {editSchedule && <button type="button" className={styles.btnDelete} onClick={() => deleteSchedule(editSchedule.id)}>Obriši smjenu</button>}
                <div style={{ flex: 1 }} />
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnAdd} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
