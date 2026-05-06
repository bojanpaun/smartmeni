// ▶ Zamijeniti: src/modules/hr/pages/HRReportsPage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './HRReportsPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// ── Helpers ──────────────────────────────────────────────────────
const fmt = d => d.toISOString().slice(0, 10)
const today = () => fmt(new Date())

function getPeriod(key) {
  const now = new Date()
  if (key === 'this_week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return [fmt(mon), fmt(sun)]
  }
  if (key === 'this_month') {
    return [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, fmt(new Date(now.getFullYear(), now.getMonth()+1, 0))]
  }
  if (key === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1)
    return [fmt(lm), fmt(new Date(now.getFullYear(), now.getMonth(), 0))]
  }
  if (key === 'last_7') {
    const s = new Date(now); s.setDate(now.getDate()-6)
    return [fmt(s), today()]
  }
  if (key === 'last_30') {
    const s = new Date(now); s.setDate(now.getDate()-29)
    return [fmt(s), today()]
  }
  return [null, null]
}

function staffName(s) {
  return (s?.first_name && s?.last_name) ? `${s.first_name} ${s.last_name}` : s?.email?.split('@')[0] || '—'
}

function HBar({ value, max, label, sub, color = '#0d7a52' }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className={styles.hBarItem}>
      <div className={styles.hBarMeta}>
        <span className={styles.hBarLabel}>{label}</span>
        <span className={styles.hBarSub}>{sub}</span>
      </div>
      <div className={styles.hBarTrack}>
        <div className={styles.hBarFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Per-zaposlenik detalji ───────────────────────────────────────
function StaffDetailModal({ staff, attendance, schedules, dateFrom, dateTo, onClose }) {
  const days = []
  const d = new Date(dateFrom)
  const end = new Date(dateTo)
  while (d <= end) { days.push(fmt(d)); d.setDate(d.getDate()+1) }

  const attByDate = {}
  attendance.forEach(a => { attByDate[a.date] = a })
  const schByDate = {}
  schedules.forEach(s => { schByDate[s.date] = s })

  const toLocalHM = iso => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })
  }

  const rows = days.map(date => {
    const att = attByDate[date]
    const sch = schByDate[date]
    const hadShift = !!sch
    const wasPresent = !!att?.clock_in
    const hours = att?.hours_worked ? parseFloat(att.hours_worked).toFixed(1) : null

    // Kašnjenje — usporedi clock_in sa rasporedom start_time
    let lateMin = 0
    if (wasPresent && sch?.start_time && att.clock_in) {
      const schStart = new Date(`${date}T${sch.start_time}`)
      const clockIn = new Date(att.clock_in)
      lateMin = Math.max(0, Math.round((clockIn - schStart) / 60000))
    }

    let status = 'off'
    if (hadShift && wasPresent) status = lateMin > 5 ? 'late' : 'present'
    else if (hadShift && !wasPresent) status = 'absent'

    return { date, att, sch, status, hours, lateMin }
  }).filter(r => r.status !== 'off') // prikaži samo radne dane

  const totalH = rows.reduce((s, r) => s + (r.hours ? parseFloat(r.hours) : 0), 0)
  const lateCount = rows.filter(r => r.status === 'late').length
  const absentCount = rows.filter(r => r.status === 'absent').length

  const statusBadge = {
    present: { bg: '#e1f5ee', color: '#0d7a52', label: 'Prisutan' },
    late:    { bg: '#faeeda', color: '#ba7517', label: 'Kasnio' },
    absent:  { bg: '#fce8e8', color: '#a32d2d', label: 'Odsutan' },
    off:     { bg: '#f0f5f2', color: '#8a9e96', label: 'Slobodan' },
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>👤 {staffName(staff)}</div>
          <div className={styles.modalSub}>{dateFrom} – {dateTo}</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Mini KPI */}
        <div className={styles.modalKpi}>
          <div className={styles.modalKpiItem}>
            <div className={styles.modalKpiVal}>{totalH.toFixed(1)}h</div>
            <div className={styles.modalKpiLbl}>Sati rada</div>
          </div>
          <div className={styles.modalKpiItem}>
            <div className={styles.modalKpiVal}>{rows.filter(r => r.status !== 'absent').length}</div>
            <div className={styles.modalKpiLbl}>Dana rada</div>
          </div>
          <div className={styles.modalKpiItem}>
            <div className={styles.modalKpiVal} style={{ color: lateCount > 0 ? '#ba7517' : '#0d7a52' }}>{lateCount}</div>
            <div className={styles.modalKpiLbl}>Kašnjenja</div>
          </div>
          <div className={styles.modalKpiItem}>
            <div className={styles.modalKpiVal} style={{ color: absentCount > 0 ? '#a32d2d' : '#0d7a52' }}>{absentCount}</div>
            <div className={styles.modalKpiLbl}>Izostanaka</div>
          </div>
        </div>

        {/* Dnevni pregled */}
        <div className={styles.modalDays}>
          {rows.length === 0 && <div className={styles.empty}>Nema zakazanih smjena u ovom periodu.</div>}
          {rows.map(r => {
            const sb = statusBadge[r.status]
            return (
              <div key={r.date} className={styles.modalDayRow}>
                <div className={styles.modalDayDate}>
                  {new Date(r.date).toLocaleDateString('sr-Latn', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                </div>
                <span className={styles.modalBadge} style={{ background: sb.bg, color: sb.color }}>
                  {sb.label}
                </span>
                {r.sch && (
                  <div className={styles.modalDayShift}>
                    Smjena: {r.sch.start_time?.slice(0,5)}–{r.sch.end_time?.slice(0,5)}
                  </div>
                )}
                {r.att?.clock_in && (
                  <div className={styles.modalDayAtt}>
                    Dolazak: {new Date(r.att.clock_in).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                    {r.att.clock_out && ` – Odlazak: ${new Date(r.att.clock_out).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}`}
                    {r.hours && ` · ${r.hours}h`}
                  </div>
                )}
                {r.lateMin > 5 && (
                  <div className={styles.modalDayLate}>⚠️ Kasni {r.lateMin} min</div>
                )}
                {r.att?.note && (
                  <div className={styles.modalDayNote}>📝 {r.att.note}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Glavna stranica ──────────────────────────────────────────────
export default function HRReportsPage() {
  const { restaurant } = usePlatform()

  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('this_month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [allAttendance, setAllAttendance] = useState([])
  const [allSchedules, setAllSchedules] = useState([])

  // Postavi datum pri promjeni perioda
  useEffect(() => {
    if (period !== 'custom') {
      const [from, to] = getPeriod(period)
      setDateFrom(from); setDateTo(to)
    }
  }, [period])

  useEffect(() => {
    if (restaurant && dateFrom && dateTo) loadData()
  }, [restaurant, dateFrom, dateTo])

  const loadData = async () => {
    setLoading(true)
    const [{ data: staff }, { data: attendance }, { data: schedules }, { data: entries }] = await Promise.all([
      supabase.from('staff').select('id, email, wage_type, wage_amount, first_name, last_name')
        .eq('restaurant_id', restaurant.id).eq('is_active', true),
      supabase.from('attendance_entries').select('staff_id, hours_worked, date, clock_in, clock_out, note')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
      supabase.from('work_schedules').select('staff_id, date, start_time, end_time, status')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
      supabase.from('payroll_entries').select('staff_id, type, amount, date')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
    ])

    setAllAttendance(attendance || [])
    setAllSchedules(schedules || [])

    const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1

    const staffStats = (staff || []).map(s => {
      const att = (attendance || []).filter(a => a.staff_id === s.id)
      const sch = (schedules || []).filter(sc => sc.staff_id === s.id)
      const ent = (entries || []).filter(e => e.staff_id === s.id)

      // Kašnjenja — usporedi clock_in sa start_time rasporeda
      const schByDate = {}
      sch.forEach(sc => { schByDate[sc.date] = sc })

      let lateCount = 0
      att.forEach(a => {
        if (!a.clock_in) return
        const sc = schByDate[a.date]
        if (!sc?.start_time) return
        const schStart = new Date(`${a.date}T${sc.start_time}`)
        const clockIn = new Date(a.clock_in)
        if (clockIn - schStart > 5 * 60 * 1000) lateCount++ // > 5 min
      })

      const hoursWorked = att.reduce((sum, a) => {
        if (a.hours_worked) return sum + parseFloat(a.hours_worked)
        if (a.clock_in && !a.clock_out)
          return sum + Math.max(0, (new Date() - new Date(a.clock_in)) / 3600000)
        return sum
      }, 0)

      const daysWorked = [...new Set(att.filter(a => a.clock_in).map(a => a.date))].length
      const daysScheduled = sch.length
      const absentCount = Math.max(0, daysScheduled - daysWorked)
      const attendanceRate = daysScheduled > 0 ? (daysWorked / daysScheduled) * 100 : null

      const wage = parseFloat(s.wage_amount || 0)
      let baseSalary = 0
      if (s.wage_type === 'hourly') baseSalary = wage * hoursWorked
      else if (s.wage_type === 'weekly') baseSalary = wage * (days / 7)
      else baseSalary = wage * (days / 30)

      const bonuses = ent.filter(e => e.type === 'bonus' || e.type === 'overtime').reduce((s, e) => s + parseFloat(e.amount), 0)
      const deductions = ent.filter(e => e.type === 'deduction' || e.type === 'advance').reduce((s, e) => s + parseFloat(e.amount), 0)
      const dailies = ent.filter(e => e.type === 'daily').reduce((s, e) => s + parseFloat(e.amount), 0)
      const totalCost = baseSalary + dailies + bonuses - deductions

      return {
        ...s,
        hoursWorked, daysWorked, daysScheduled, absentCount,
        lateCount, attendanceRate,
        baseSalary, bonuses, deductions, dailies, totalCost,
      }
    }).sort((a, b) => b.hoursWorked - a.hoursWorked)

    const totalHours = staffStats.reduce((s, e) => s + e.hoursWorked, 0)
    const totalLaborCost = staffStats.reduce((s, e) => s + e.totalCost, 0)
    const avgAttendance = staffStats.filter(s => s.attendanceRate !== null)
      .reduce((s, e) => s + e.attendanceRate, 0) / (staffStats.filter(s => s.attendanceRate !== null).length || 1)
    const totalLate = staffStats.reduce((s, e) => s + e.lateCount, 0)

    setData({ staffStats, totalHours, totalLaborCost, avgAttendance, totalLate, days })
    setLoading(false)
  }

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Zaposlenik', 'Sati rada', 'Dana rada', 'Zakazano', 'Izostanaka', 'Kašnjenja', 'Prisustvo %', 'Osnovna', 'Dnevnice', 'Bonusi', 'Odbitci', 'Ukupno €'],
      ...data.staffStats.map(s => [
        staffName(s),
        s.hoursWorked.toFixed(1),
        s.daysWorked,
        s.daysScheduled,
        s.absentCount,
        s.lateCount,
        s.attendanceRate !== null ? s.attendanceRate.toFixed(0) + '%' : '—',
        s.baseSalary.toFixed(2),
        s.dailies.toFixed(2),
        s.bonuses.toFixed(2),
        s.deductions.toFixed(2),
        s.totalCost.toFixed(2),
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hr-izvjestaj-${dateFrom}-${dateTo}.csv`
    a.click()
  }

  const PERIOD_OPTS = [
    { key: 'last_7',     label: 'Zadnjih 7 dana' },
    { key: 'this_week',  label: 'Ova sedmica' },
    { key: 'this_month', label: 'Ovaj mjesec' },
    { key: 'last_month', label: 'Prošli mjesec' },
    { key: 'last_30',    label: 'Zadnjih 30 dana' },
    { key: 'custom',     label: 'Prilagođeno' },
  ]

  if (loading && !data) return <div className={styles.loading}>Učitavanje...</div>

  const maxHours = Math.max(...(data?.staffStats || []).map(s => s.hoursWorked), 1)
  const maxCost  = Math.max(...(data?.staffStats || []).map(s => s.totalCost), 1)

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={gsStyles.title}>Analitika HR</h1>
          <p className={gsStyles.subtitle}>Detaljan izvještaj prisustva, kašnjenja i troškova rada.</p>
        </div>
        <button className={styles.btnExport} onClick={exportCSV}>↓ Export CSV</button>
      </div>

      {/* Period filter */}
      <div className={styles.periodBar}>
        {PERIOD_OPTS.map(opt => (
          <button
            key={opt.key}
            className={`${styles.periodBtn} ${period === opt.key ? styles.periodBtnActive : ''}`}
            onClick={() => setPeriod(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className={styles.filters}>
          <input type="date" className={styles.filterDate} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className={styles.filterSep}>—</span>
          <input type="date" className={styles.filterDate} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {data && <span className={styles.filterInfo}>{data.days} dana</span>}
        </div>
      )}

      {loading && <div className={styles.loadingInline}>Učitavanje...</div>}

      {data && !loading && (
        <>
          {/* KPI */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ukupno sati</div>
              <div className={styles.kpiVal}>{data.totalHours.toFixed(1)}h</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Trošak rada</div>
              <div className={styles.kpiVal}>€{data.totalLaborCost.toFixed(2)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Prosj. prisustvo</div>
              <div className={styles.kpiVal} style={{ color: data.avgAttendance < 70 ? '#a32d2d' : '#0d7a52' }}>
                {data.avgAttendance.toFixed(0)}%
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ukupno kašnjenja</div>
              <div className={styles.kpiVal} style={{ color: data.totalLate > 0 ? '#ba7517' : '#0d7a52' }}>
                {data.totalLate}×
              </div>
            </div>
          </div>

          {/* Detaljna tabela */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Pregled po zaposleniku</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Zaposlenik</th>
                    <th>Sati</th>
                    <th>Dana</th>
                    <th>Izostanaka</th>
                    <th>Kašnjenja</th>
                    <th>Prisustvo</th>
                    <th>Ukupno €</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffStats.length === 0 && (
                    <tr><td colSpan={8} className={styles.empty}>Nema podataka za odabrani period.</td></tr>
                  )}
                  {data.staffStats.map((s, i) => (
                    <tr key={i} className={styles.tableRow}>
                      <td className={styles.tableName}>{staffName(s)}</td>
                      <td>{s.hoursWorked.toFixed(1)}h</td>
                      <td>{s.daysWorked}/{s.daysScheduled}</td>
                      <td>
                        <span className={s.absentCount > 0 ? styles.badgeRed : styles.badgeGreen}>
                          {s.absentCount}×
                        </span>
                      </td>
                      <td>
                        <span className={s.lateCount > 0 ? styles.badgeYellow : styles.badgeGreen}>
                          {s.lateCount}×
                        </span>
                      </td>
                      <td>
                        <span className={s.attendanceRate !== null && s.attendanceRate < 70 ? styles.low : ''}>
                          {s.attendanceRate !== null ? `${s.attendanceRate.toFixed(0)}%` : '—'}
                        </span>
                      </td>
                      <td className={styles.tableTotal}>€{s.totalCost.toFixed(2)}</td>
                      <td>
                        <button
                          className={styles.btnDetail}
                          onClick={() => setSelectedStaff(s)}
                        >
                          Detalji →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.tableFooter}>
                    <td>Ukupno</td>
                    <td>{data.totalHours.toFixed(1)}h</td>
                    <td></td>
                    <td></td>
                    <td>{data.totalLate}×</td>
                    <td>{data.avgAttendance.toFixed(0)}%</td>
                    <td className={styles.tableTotal}>€{data.totalLaborCost.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bar charts */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Sati rada po zaposleniku</div>
            <div className={styles.hBarList}>
              {data.staffStats.map((s, i) => (
                <HBar key={i} value={s.hoursWorked} max={maxHours}
                  label={staffName(s)}
                  sub={`${s.hoursWorked.toFixed(1)}h · ${s.daysWorked} dana · ${s.lateCount > 0 ? `${s.lateCount}× kasni` : 'bez kašnjenja'}`}
                  color="#0d7a52" />
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Trošak rada po zaposleniku</div>
            <div className={styles.hBarList}>
              {data.staffStats.map((s, i) => (
                <HBar key={i} value={s.totalCost} max={maxCost}
                  label={staffName(s)}
                  sub={`€${s.totalCost.toFixed(2)} · osnova €${s.baseSalary.toFixed(2)} + dnevnice €${s.dailies.toFixed(2)}`}
                  color="#ef9f27" />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detalji zaposlenika modal */}
      {selectedStaff && (
        <StaffDetailModal
          staff={selectedStaff}
          attendance={allAttendance.filter(a => a.staff_id === selectedStaff.id)}
          schedules={allSchedules.filter(s => s.staff_id === selectedStaff.id)}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setSelectedStaff(null)}
        />
      )}
    </div>
  )
}
