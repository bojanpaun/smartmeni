import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const ENTRY_TYPES = {
  salary:    { label: 'Zarada',       color: '#0d7a52' },
  daily:     { label: 'Dnevnica',     color: '#3aaa70' },
  bonus:     { label: 'Bonus',        color: '#378add' },
  overtime:  { label: 'Prekovremeni', color: '#7f77dd' },
  deduction: { label: 'Odbitak',      color: '#c0392b' },
  advance:   { label: 'Akontacija',   color: '#ef9f27' },
}
const ABSENCE_TYPES = {
  vacation: { label: 'Godišnji odmor', color: '#0d7a52', bg: '#e0f5ec' },
  sick:     { label: 'Bolovanje',      color: '#378add', bg: '#e6f1fb' },
  personal: { label: 'Lični razlog',   color: '#ef9f27', bg: '#faeeda' },
  other:    { label: 'Ostalo',         color: '#8a9e96', bg: '#f0f5f2' },
}
const TODAY = new Date().toISOString().slice(0, 10)
function mStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function mEnd() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0, 10)
}

export default function HrView({ staffId, activeTab }) {
  const [schedules, setSchedules]   = useState([])
  const [attendance, setAttendance] = useState([])
  const [payroll, setPayroll]       = useState([])
  const [absences, setAbsences]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [staffInfo, setStaffInfo]   = useState(null)
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => {
    if (!staffId) return
    setLoading(true)
    const from = mStart(), to = mEnd()
    Promise.all([
      supabase.from('staff').select('wage_type, wage_amount, vacation_days_total, first_name, last_name')
        .eq('id', staffId).maybeSingle(),
      supabase.from('work_schedules').select('*').eq('staff_id', staffId)
        .gte('date', from).lte('date', to).order('date'),
      supabase.from('attendance_entries').select('*').eq('staff_id', staffId)
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('staff_absences').select('*').eq('staff_id', staffId)
        .order('start_date', { ascending: false }).limit(20),
    ]).then(([{ data: si }, { data: sch }, { data: att }, { data: abs }]) => {
      setStaffInfo(si)
      setSchedules(sch ?? [])
      setAttendance(att ?? [])
      setAbsences(abs ?? [])
      setLoading(false)
    })
  }, [staffId])

  useEffect(() => {
    if (!staffId || activeTab !== 'payroll') return
    const from = payrollMonth + '-01'
    const [y, m] = payrollMonth.split('-').map(Number)
    const to = new Date(y, m, 0).toISOString().slice(0, 10)
    supabase.from('payroll_entries').select('*').eq('staff_id', staffId)
      .gte('date', from).lte('date', to).order('date', { ascending: false })
      .then(({ data }) => setPayroll(data ?? []))
  }, [staffId, activeTab, payrollMonth])

  const thisWeek = schedules.filter(s => {
    const d = new Date(s.date), now = new Date()
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7))
    const sun = new Date(mon); sun.setDate(mon.getDate()+6)
    return d >= mon && d <= sun
  })

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  // ── Raspored ─────────────────────────────────────────────────────
  if (activeTab === 'schedule') return (
    <div>
      {thisWeek.length > 0 && (
        <div className={s.card}>
          <div className={s.cardTitle}>Ova sedmica</div>
          {thisWeek.map(sh => (
            <div key={sh.id} className={s.shiftRow}>
              <div className={s.shiftDay}>
                {new Date(sh.date).toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                {sh.date === TODAY && <span className={s.todayBadge}>Danas</span>}
              </div>
              <div className={s.shiftTime}>{sh.start_time?.slice(0,5)} – {sh.end_time?.slice(0,5)}</div>
            </div>
          ))}
        </div>
      )}
      <div className={s.card}>
        <div className={s.cardTitle}>Sve smjene — {new Date().toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' })}</div>
        {schedules.length === 0
          ? <div className={s.empty}><div className={s.emptyIcon}>📅</div><div className={s.emptyText}>Nema zakazanih smjena.</div></div>
          : schedules.map(sh => (
            <div key={sh.id} className={s.shiftRow}>
              <div className={s.shiftDay}>
                {new Date(sh.date).toLocaleDateString('sr-Latn', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                {sh.date === TODAY && <span className={s.todayBadge}>Danas</span>}
              </div>
              <div className={s.shiftTime}>{sh.start_time?.slice(0,5)} – {sh.end_time?.slice(0,5)}</div>
            </div>
          ))
        }
      </div>
    </div>
  )

  // ── Dolasci ──────────────────────────────────────────────────────
  if (activeTab === 'attendance') return (
    <div className={s.card}>
      <div className={s.cardTitle}>Dolasci — {new Date().toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' })}</div>
      {attendance.length === 0
        ? <div className={s.empty}><div className={s.emptyIcon}>🕐</div><div className={s.emptyText}>Nema evidentiranih dolazaka.</div></div>
        : attendance.map(a => (
          <div key={a.id} className={s.attRow}>
            <div className={s.attDate}>{new Date(a.date).toLocaleDateString('sr-Latn', { weekday: 'short', day: 'numeric', month: 'numeric' })}</div>
            <div className={s.attTimes}>
              <span>↓ {a.clock_in ? new Date(a.clock_in).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <span>↑ {a.clock_out ? new Date(a.clock_out).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' }) : 'na poslu'}</span>
            </div>
            {a.hours_worked && <div className={s.attHours} style={{ color: '#0d7a52' }}>{parseFloat(a.hours_worked).toFixed(1)}h</div>}
          </div>
        ))
      }
    </div>
  )

  // ── Zarada ───────────────────────────────────────────────────────
  if (activeTab === 'payroll') {
    const wage = parseFloat(staffInfo?.wage_amount || 0)
    const [py, pm] = payrollMonth.split('-').map(Number)
    const days = new Date(py, pm, 0).getDate()
    const base = staffInfo?.wage_type === 'weekly' ? wage * Math.ceil(days/7) : (staffInfo?.wage_type === 'hourly' ? 0 : wage)
    const adds = payroll.filter(e => !['deduction','advance'].includes(e.type)).reduce((t,e) => t + parseFloat(e.amount||0), 0)
    const deds = payroll.filter(e => ['deduction','advance'].includes(e.type)).reduce((t,e) => t + parseFloat(e.amount||0), 0)
    return (
      <div>
        <div className={s.monthPicker}>
          <label>Mjesec:</label>
          <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} />
        </div>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}><div className={s.kpiLabel}>Osnovna</div><div className={s.kpiVal}>€{base.toFixed(0)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>Dodaci</div><div className={s.kpiVal} style={{ color: '#0d7a52' }}>+€{adds.toFixed(0)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>Odbitci</div><div className={s.kpiVal} style={{ color: '#c0392b' }}>-€{deds.toFixed(0)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>Neto</div><div className={s.kpiVal} style={{ color: '#0d7a52' }}>€{(base+adds-deds).toFixed(0)}</div></div>
        </div>
        <div className={s.card}>
          {payroll.length === 0
            ? <div className={s.empty}><div className={s.emptyText}>Nema stavki za ovaj mjesec.</div></div>
            : payroll.map(e => {
              const et = ENTRY_TYPES[e.type] || ENTRY_TYPES.salary
              const isDed = ['deduction','advance'].includes(e.type)
              return (
                <div key={e.id} className={s.payRow}>
                  <span className={s.badge} style={{ background: '#f3f4f6', color: et.color }}>{et.label}</span>
                  <div className={s.payAmount} style={{ color: isDed ? '#c0392b' : '#0d7a52' }}>
                    {isDed ? '-' : '+'}€{parseFloat(e.amount).toFixed(2)}
                  </div>
                  <div className={s.payMeta}>{new Date(e.date).toLocaleDateString('sr-Latn')}{e.note ? ` · ${e.note}` : ''}</div>
                </div>
              )
            })
          }
        </div>
      </div>
    )
  }

  // ── Odsustva ─────────────────────────────────────────────────────
  if (activeTab === 'absences') {
    const year = new Date().getFullYear()
    const vacUsed = absences.filter(a => a.absence_type === 'vacation' && a.approved && new Date(a.start_date).getFullYear() === year)
      .reduce((t, a) => t + (a.days || 0), 0)
    const vacTotal = staffInfo?.vacation_days_total || 0
    return (
      <div>
        <div className={s.vacRow}>
          <div className={s.vacCard}><div className={s.vacNum}>{vacTotal}</div><div className={s.vacLabel}>Ukupno dana</div></div>
          <div className={s.vacCard}><div className={s.vacNum} style={{ color: '#ba7517' }}>{vacUsed}</div><div className={s.vacLabel}>Iskorišteno</div></div>
          <div className={s.vacCard}><div className={s.vacNum}>{Math.max(0, vacTotal - vacUsed)}</div><div className={s.vacLabel}>Preostalo</div></div>
        </div>
        <div className={s.card}>
          <div className={s.cardTitle}>Evidencija odsustva</div>
          {absences.length === 0
            ? <div className={s.empty}><div className={s.emptyText}>Nema evidentiranih odsustva.</div></div>
            : absences.map(a => {
              const at = ABSENCE_TYPES[a.absence_type] || ABSENCE_TYPES.other
              return (
                <div key={a.id} className={s.absRow}>
                  <span className={s.badge} style={{ background: at.bg, color: at.color }}>{at.label}</span>
                  <div className={s.absDates}>
                    {new Date(a.start_date).toLocaleDateString('sr-Latn')} – {new Date(a.end_date).toLocaleDateString('sr-Latn')}
                    <span style={{ color: '#9ca3af' }}> · {a.days} {a.days === 1 ? 'dan' : 'dana'}</span>
                  </div>
                  {a.approved
                    ? <span className={s.approvedBadge}>✓ Odobreno</span>
                    : <span className={s.pendingBadge}>Na čekanju</span>
                  }
                </div>
              )
            })
          }
        </div>
      </div>
    )
  }

  return null
}
