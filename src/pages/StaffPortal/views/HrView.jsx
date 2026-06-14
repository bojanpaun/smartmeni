import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import s from '../StaffPortal.module.css'

const ENTRY_TYPES = {
  salary:    { labelKey: 'entrySalary',       color: '#0d7a52' },
  daily:     { labelKey: 'entryDaily',     color: '#3aaa70' },
  bonus:     { labelKey: 'entryBonus',        color: '#378add' },
  overtime:  { labelKey: 'entryOvertime', color: '#7f77dd' },
  deduction: { labelKey: 'entryDeduction',      color: '#c0392b' },
  advance:   { labelKey: 'entryAdvance',   color: '#ef9f27' },
}
const ABSENCE_TYPES = {
  vacation: { labelKey: 'absVacation', color: '#0d7a52', bg: '#e0f5ec' },
  sick:     { labelKey: 'absSick',      color: '#378add', bg: '#e6f1fb' },
  personal: { labelKey: 'absPersonal',   color: '#ef9f27', bg: '#faeeda' },
  other:    { labelKey: 'absOther',         color: '#8a9e96', bg: '#f0f5f2' },
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

export default function HrView({ staffId, activeTab, currency }) {
  const { t, i18n } = useTranslation('staffportal')
  const money = (a) => formatMoney(a, currency, i18n.language)
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
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
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [absenceForm, setAbsenceForm] = useState({ absence_type: 'vacation', start_date: '', end_date: '', notes: '' })
  const [absenceSaving, setAbsenceSaving] = useState(false)

  const loadAbsences = async () => {
    const { data } = await supabase.from('staff_absences').select('*')
      .eq('staff_id', staffId).order('start_date', { ascending: false }).limit(20)
    setAbsences(data ?? [])
  }

  const submitAbsence = async (e) => {
    e.preventDefault()
    if (!absenceForm.start_date || !absenceForm.end_date) return
    setAbsenceSaving(true)
    const days = Math.ceil((new Date(absenceForm.end_date) - new Date(absenceForm.start_date)) / 86400000) + 1
    const { data: staffRow } = await supabase.from('staff').select('restaurant_id').eq('id', staffId).single()
    await supabase.from('staff_absences').insert({
      staff_id: staffId,
      restaurant_id: staffRow?.restaurant_id,
      absence_type: absenceForm.absence_type,
      start_date: absenceForm.start_date,
      end_date: absenceForm.end_date,
      days,
      notes: absenceForm.notes || null,
      approved: null,
    })
    setAbsenceSaving(false)
    setShowAbsenceForm(false)
    setAbsenceForm({ absence_type: 'vacation', start_date: '', end_date: '', notes: '' })
    loadAbsences()
  }

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

  if (loading) return <div className={s.loadingInline}>{t('loading')}</div>

  // ── Raspored ─────────────────────────────────────────────────────
  if (activeTab === 'schedule') return (
    <div>
      {thisWeek.length > 0 && (
        <div className={s.card}>
          <div className={s.cardTitle}>{t('thisWeek')}</div>
          {thisWeek.map(sh => (
            <div key={sh.id} className={s.shiftRow}>
              <div className={s.shiftDay}>
                {new Date(sh.date).toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'numeric' })}
                {sh.date === TODAY && <span className={s.todayBadge}>{t('today')}</span>}
              </div>
              <div className={s.shiftTime}>{sh.start_time?.slice(0,5)} – {sh.end_time?.slice(0,5)}</div>
            </div>
          ))}
        </div>
      )}
      <div className={s.card}>
        <div className={s.cardTitle}>{t('allShifts', { month: new Date().toLocaleDateString(dl, { month: 'long', year: 'numeric' }) })}</div>
        {schedules.length === 0
          ? <div className={s.empty}><div className={s.emptyIcon}>📅</div><div className={s.emptyText}>{t('noShifts')}</div></div>
          : schedules.map(sh => (
            <div key={sh.id} className={s.shiftRow}>
              <div className={s.shiftDay}>
                {new Date(sh.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'numeric' })}
                {sh.date === TODAY && <span className={s.todayBadge}>{t('today')}</span>}
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
      <div className={s.cardTitle}>{t('attendanceTitle', { month: new Date().toLocaleDateString(dl, { month: 'long', year: 'numeric' }) })}</div>
      {attendance.length === 0
        ? <div className={s.empty}><div className={s.emptyIcon}>🕐</div><div className={s.emptyText}>{t('noAttendance')}</div></div>
        : attendance.map(a => (
          <div key={a.id} className={s.attRow}>
            <div className={s.attDate}>{new Date(a.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'numeric' })}</div>
            <div className={s.attTimes}>
              <span>↓ {a.clock_in ? new Date(a.clock_in).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <span>↑ {a.clock_out ? new Date(a.clock_out).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }) : t('atWork')}</span>
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
          <label>{t('month')}</label>
          <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} />
        </div>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}><div className={s.kpiLabel}>{t('payBase')}</div><div className={s.kpiVal}>{money(base)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>{t('payAdds')}</div><div className={s.kpiVal} style={{ color: '#0d7a52' }}>+{money(adds)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>{t('payDeds')}</div><div className={s.kpiVal} style={{ color: '#c0392b' }}>-{money(deds)}</div></div>
          <div className={s.kpiCard}><div className={s.kpiLabel}>{t('payNet')}</div><div className={s.kpiVal} style={{ color: '#0d7a52' }}>{money(base+adds-deds)}</div></div>
        </div>
        <div className={s.card}>
          {payroll.length === 0
            ? <div className={s.empty}><div className={s.emptyText}>{t('noPayrollItems')}</div></div>
            : payroll.map(e => {
              const et = ENTRY_TYPES[e.type] || ENTRY_TYPES.salary
              const isDed = ['deduction','advance'].includes(e.type)
              return (
                <div key={e.id} className={s.payRow}>
                  <span className={s.badge} style={{ background: '#f3f4f6', color: et.color }}>{t(et.labelKey)}</span>
                  <div className={s.payAmount} style={{ color: isDed ? '#c0392b' : '#0d7a52' }}>
                    {isDed ? '-' : '+'}{money(e.amount)}
                  </div>
                  <div className={s.payMeta}>{new Date(e.date).toLocaleDateString(dl)}{e.note ? ` · ${e.note}` : ''}</div>
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
    const vacUsed = absences
      .filter(a => a.absence_type === 'vacation' && a.approved === true && new Date(a.start_date).getFullYear() === year)
      .reduce((t, a) => t + (a.days || 0), 0)
    const vacTotal = staffInfo?.vacation_days_total || 0
    return (
      <div>
        <div className={s.vacRow}>
          <div className={s.vacCard}><div className={s.vacNum}>{vacTotal}</div><div className={s.vacLabel}>{t('vacTotalDays')}</div></div>
          <div className={s.vacCard}><div className={s.vacNum} style={{ color: '#ba7517' }}>{vacUsed}</div><div className={s.vacLabel}>{t('vacUsed')}</div></div>
          <div className={s.vacCard}><div className={s.vacNum}>{Math.max(0, vacTotal - vacUsed)}</div><div className={s.vacLabel}>{t('vacRemaining')}</div></div>
        </div>

        {/* Forma za novi zahtjev */}
        {!showAbsenceForm ? (
          <button className={s.btnAddAbsence} onClick={() => setShowAbsenceForm(true)}>
            + {t('requestAbsence')}
          </button>
        ) : (
          <form className={s.absenceForm} onSubmit={submitAbsence}>
            <div className={s.absenceFormTitle}>{t('newAbsenceTitle')}</div>
            <div className={s.absenceFormField}>
              <label>{t('absenceType')}</label>
              <select value={absenceForm.absence_type} onChange={e => setAbsenceForm(f => ({ ...f, absence_type: e.target.value }))}>
                {Object.entries(ABSENCE_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v.labelKey)}</option>)}
              </select>
            </div>
            <div className={s.absenceFormRow}>
              <div className={s.absenceFormField}>
                <label>{t('from')}</label>
                <input type="date" required min={TODAY} value={absenceForm.start_date}
                  onChange={e => setAbsenceForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} />
              </div>
              <div className={s.absenceFormField}>
                <label>{t('to')}</label>
                <input type="date" required min={absenceForm.start_date || TODAY} value={absenceForm.end_date}
                  onChange={e => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className={s.absenceFormField}>
              <label>{t('noteOptional')}</label>
              <textarea rows={2} placeholder={t('reasonPlaceholder')} value={absenceForm.notes}
                onChange={e => setAbsenceForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className={s.absenceFormActions}>
              <button type="button" className={s.btnSecondary} onClick={() => setShowAbsenceForm(false)}>{t('cancel')}</button>
              <button type="submit" className={s.btnPrimary} style={{ flex: 2 }} disabled={absenceSaving}>
                {absenceSaving ? t('sending') : t('sendRequest')}
              </button>
            </div>
          </form>
        )}

        <div className={s.card}>
          <div className={s.cardTitle}>{t('absenceLog')}</div>
          {absences.length === 0
            ? <div className={s.empty}><div className={s.emptyText}>{t('noAbsences')}</div></div>
            : absences.map(a => {
              const at = ABSENCE_TYPES[a.absence_type] || ABSENCE_TYPES.other
              return (
                <div key={a.id} className={s.absRow}>
                  <span className={s.badge} style={{ background: at.bg, color: at.color }}>{t(at.labelKey)}</span>
                  <div className={s.absDates}>
                    {new Date(a.start_date).toLocaleDateString(dl)} – {new Date(a.end_date).toLocaleDateString(dl)}
                    <span style={{ color: '#9ca3af' }}> · {a.days} {a.days === 1 ? t('dayOne') : t('dayOther')}</span>
                  </div>
                  {a.approved === true  && <span className={s.approvedBadge}>✓ {t('approved')}</span>}
                  {a.approved === null  && <span className={s.pendingBadge}>{t('pending')}</span>}
                  {a.approved === false && <span className={s.rejectedBadge}>✗ {t('rejected')}</span>}
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
