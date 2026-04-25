// ▶ Novi fajl: src/modules/hr/pages/HRReportsPage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './HRReportsPage.module.css'

function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function monthEnd() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
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

export default function HRReportsPage() {
  const { restaurant } = usePlatform()

  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [data, setData] = useState(null)

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant, dateFrom, dateTo])

  const loadData = async () => {
    setLoading(true)
    const [{ data: staff }, { data: attendance }, { data: schedules }, { data: entries }] = await Promise.all([
      supabase.from('staff').select('id, email, wage_type, wage_amount, first_name, last_name')
        .eq('restaurant_id', restaurant.id).eq('is_active', true),
      supabase.from('attendance_entries').select('staff_id, hours_worked, date, clock_in, clock_out')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
      supabase.from('work_schedules').select('staff_id, date, start_time, end_time, status')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
      supabase.from('payroll_entries').select('staff_id, type, amount, date')
        .eq('restaurant_id', restaurant.id).gte('date', dateFrom).lte('date', dateTo),
    ])

    const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1

    const staffStats = (staff || []).map(s => {
      const att = (attendance || []).filter(a => a.staff_id === s.id)
      const sch = (schedules || []).filter(sc => sc.staff_id === s.id)
      const ent = (entries || []).filter(e => e.staff_id === s.id)

      const hoursWorked = att.reduce((sum, a) => {
        if (a.hours_worked) return sum + parseFloat(a.hours_worked)
        if (a.clock_in && !a.clock_out) {
          return sum + Math.max(0, (new Date() - new Date(a.clock_in)) / 3600000)
        }
        return sum
      }, 0)
      const daysWorked = [...new Set(att.filter(a => a.clock_in).map(a => a.date))].length
      const daysScheduled = sch.length
      const lateCount = 0 // TODO: uporediti sa rasporedom
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
        hoursWorked, daysWorked, daysScheduled,
        lateCount, attendanceRate,
        baseSalary, bonuses, deductions, dailies, totalCost,
      }
    }).sort((a, b) => b.hoursWorked - a.hoursWorked)

    const totalHours = staffStats.reduce((s, e) => s + e.hoursWorked, 0)
    const totalLaborCost = staffStats.reduce((s, e) => s + e.totalCost, 0)
    const avgAttendance = staffStats.filter(s => s.attendanceRate !== null).reduce((s, e) => s + e.attendanceRate, 0) / (staffStats.filter(s => s.attendanceRate !== null).length || 1)

    setData({ staffStats, totalHours, totalLaborCost, avgAttendance, days })
    setLoading(false)
  }

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Zaposlenik', 'Sati rada', 'Dana rada', 'Zakazano dana', 'Stopa prisustva', 'Kasnjenja', 'Osnovna plata', 'Dnevnice', 'Bonusi', 'Odbitci', 'Ukupno'],
      ...data.staffStats.map(s => [
        (s.first_name && s.last_name) ? `${s.first_name} ${s.last_name}` : s.email,
        s.hoursWorked.toFixed(1),
        s.daysWorked,
        s.daysScheduled,
        s.attendanceRate !== null ? s.attendanceRate.toFixed(0) + '%' : '—',
        s.lateCount,
        s.baseSalary.toFixed(2),
        s.dailies.toFixed(2),
        s.bonuses.toFixed(2),
        s.deductions.toFixed(2),
        s.totalCost.toFixed(2),
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hr-izvjestaj-${dateFrom}-${dateTo}.csv`
    a.click()
  }

  const staffName = (s) => (s?.first_name && s?.last_name) ? `${s.first_name} ${s.last_name}` : s?.email?.split('@')[0] || '—'

  if (loading) return <div className={styles.loading}>Učitavanje izvještaja...</div>
  if (!data) return null

  const maxHours = Math.max(...data.staffStats.map(s => s.hoursWorked), 1)
  const maxCost = Math.max(...data.staffStats.map(s => s.totalCost), 1)

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div className={styles.headerTitle}>HR Izvještaji</div>
        <button className={styles.btnExport} onClick={exportCSV}>↓ Export CSV</button>
      </div>

      {/* Period filter */}
      <div className={styles.filters}>
        <input type="date" className={styles.filterDate} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className={styles.filterSep}>—</span>
        <input type="date" className={styles.filterDate} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span className={styles.filterInfo}>{data.days} dana</span>
      </div>

      {/* KPI */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ukupno sati rada</div>
          <div className={styles.kpiVal}>{data.totalHours.toFixed(1)}h</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Ukupni trošak rada</div>
          <div className={styles.kpiVal}>€{data.totalLaborCost.toFixed(2)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Prosj. stopa prisustva</div>
          <div className={styles.kpiVal}>{data.avgAttendance.toFixed(0)}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Aktivnih zaposlenih</div>
          <div className={styles.kpiVal}>{data.staffStats.length}</div>
        </div>
      </div>

      {/* Sati po zaposleniku */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Sati rada po zaposleniku</div>
        {data.staffStats.length === 0
          ? <div className={styles.empty}>Nema podataka za odabrani period.</div>
          : <div className={styles.hBarList}>
              {data.staffStats.map((s, i) => (
                <HBar key={i} value={s.hoursWorked} max={maxHours}
                  label={staffName(s)}
                  sub={`${s.hoursWorked.toFixed(1)}h · ${s.daysWorked} dana · ${s.lateCount > 0 ? `${s.lateCount}× kasni` : 'bez kašnjenja'}`}
                  color="#0d7a52" />
              ))}
            </div>
        }
      </div>

      {/* Trošak po zaposleniku */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Trošak rada po zaposleniku</div>
        {data.staffStats.length === 0
          ? <div className={styles.empty}>Nema podataka.</div>
          : <div className={styles.hBarList}>
              {data.staffStats.map((s, i) => (
                <HBar key={i} value={s.totalCost} max={maxCost}
                  label={staffName(s)}
                  sub={`€${s.totalCost.toFixed(2)} · osnova €${s.baseSalary.toFixed(2)} + dnevnice €${s.dailies.toFixed(2)}`}
                  color="#ef9f27" />
              ))}
            </div>
        }
      </div>

      {/* Detaljna tabela */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Detaljna tabela</div>
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Zaposlenik</span>
            <span>Sati</span>
            <span>Dana</span>
            <span>Prisustvo</span>
            <span>Kasni</span>
            <span>Ukupno €</span>
          </div>
          {data.staffStats.map((s, i) => (
            <div key={i} className={styles.tableRow}>
              <span className={styles.tableName}>{staffName(s)}</span>
              <span>{s.hoursWorked.toFixed(1)}h</span>
              <span>{s.daysWorked}/{s.daysScheduled}</span>
              <span className={s.attendanceRate !== null && s.attendanceRate < 70 ? styles.low : ''}>
                {s.attendanceRate !== null ? `${s.attendanceRate.toFixed(0)}%` : '—'}
              </span>
              <span className={s.lateCount > 3 ? styles.low : ''}>{s.lateCount}×</span>
              <span className={styles.tableTotal}>€{s.totalCost.toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.tableFooter}>
            <span>Ukupno</span>
            <span>{data.totalHours.toFixed(1)}h</span>
            <span></span>
            <span>{data.avgAttendance.toFixed(0)}%</span>
            <span></span>
            <span className={styles.tableTotal}>€{data.totalLaborCost.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
