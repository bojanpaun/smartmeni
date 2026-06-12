// src/modules/hr/pages/StaffPortalPage.jsx
// Dostupno na: /:slug/osoblje

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './StaffPortalPage.module.css'

const ENTRY_TYPES = {
  salary:    { labelKey: 'payTypeSalary',    color: '#0d7a52', bg: '#e1f5ee' },
  daily:     { labelKey: 'payTypeDaily',     color: '#3aaa70', bg: '#e1f5ee' },
  bonus:     { labelKey: 'payTypeBonus',     color: '#378add', bg: '#e6f1fb' },
  overtime:  { labelKey: 'payTypeOvertime',  color: '#7f77dd', bg: '#eeedfe' },
  deduction: { labelKey: 'payTypeDeduction', color: '#c0392b', bg: '#fce8e8' },
  advance:   { labelKey: 'payTypeAdvance',   color: '#ef9f27', bg: '#faeeda' },
}

const ABSENCE_TYPES = {
  vacation: { labelKey: 'sppVacation', color: '#0d7a52', bg: '#e0f5ec' },
  sick:     { labelKey: 'sppSick',     color: '#378add', bg: '#e6f1fb' },
  personal: { labelKey: 'sppPersonal', color: '#ef9f27', bg: '#faeeda' },
  other:    { labelKey: 'htTypeOther', color: '#8a9e96', bg: '#f0f5f2' },
}

function mStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function mEnd() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10)
}
function monthStr(m, dl) {
  const [y, mo] = m.split('-')
  return new Date(y, mo-1).toLocaleDateString(dl, { month: 'long', year: 'numeric' })
}

export default function StaffPortalPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login') // login | portal
  const [activeTab, setActiveTab] = useState('schedule')

  // Auth state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Staff data
  const [staff, setStaff] = useState(null)
  const [session, setSession] = useState(null)

  // Data
  const [schedules, setSchedules] = useState([])
  const [attendance, setAttendance] = useState([])
  const [payroll, setPayroll] = useState([])
  const [absences, setAbsences] = useState([])
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    loadRestaurant()
    // Provjeri postojeću sesiju
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) tryLoadStaff(session)
    })
  }, [slug])

  const loadRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template')
      .eq('slug', slug)
      .single()
    setRestaurant(data)
    setLoading(false)
  }

  const tryLoadStaff = async (sess) => {
    if (!sess || !restaurant) return
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', sess.user.id)
      .eq('restaurant_id', restaurant?.id)
      .eq('is_active', true)
      .single()
    if (staffData) {
      setStaff(staffData)
      setSession(sess)
      setMode('portal')
      loadAllData(staffData.id)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(t('hkppWrongCreds'))
      setAuthLoading(false)
      return
    }
    // Provjeri da je zaposleni u ovom restoranu
    if (!restaurant) { setAuthError(t('sppRestaurantErr')); setAuthLoading(false); return }
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .single()
    if (!staffData) {
      await supabase.auth.signOut()
      setAuthError(t('sppNotEmployee'))
      setAuthLoading(false)
      return
    }
    setStaff(staffData)
    setSession(data.session)
    setMode('portal')
    loadAllData(staffData.id)
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStaff(null)
    setSession(null)
    setMode('login')
  }

  const loadAllData = async (staffId) => {
    setDataLoading(true)
    const from = mStart()
    const to = mEnd()
    const [{ data: sch }, { data: att }, { data: abs }] = await Promise.all([
      supabase.from('work_schedules').select('*').eq('staff_id', staffId)
        .gte('date', from).lte('date', to).order('date'),
      supabase.from('attendance_entries').select('*').eq('staff_id', staffId)
        .gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('staff_absences').select('*').eq('staff_id', staffId)
        .order('start_date', { ascending: false }).limit(20),
    ])
    setSchedules(sch || [])
    setAttendance(att || [])
    setAbsences(abs || [])
    setDataLoading(false)
  }

  const loadPayroll = async (staffId, month) => {
    const from = month + '-01'
    const [y, m] = month.split('-').map(Number)
    const to = new Date(y, m, 0).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('payroll_entries')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
    setPayroll(data || [])
  }

  useEffect(() => {
    if (staff && activeTab === 'payroll') loadPayroll(staff.id, payrollMonth)
  }, [staff, activeTab, payrollMonth])

  if (loading) return (
    <div className={styles.loading}>{t('loading')}</div>
  )

  if (!restaurant) return (
    <div className={styles.loading}>{t('sppRestaurantNotFound')}</div>
  )

  const tpl = getTemplate(restaurant.template)
  const brand = tpl?.brand || restaurant.color || '#0d7a52'
  const staffName = staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.email : ''

  // ── LOGIN ──────────────────────────────────────────────────────
  if (mode === 'login') return (
    <div className={styles.page}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader} style={{ background: brand }}>
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.loginLogo} />
            : <div className={styles.loginLogoPlaceholder}>{restaurant.name[0]}</div>
          }
          <div className={styles.loginRestName}>{restaurant.name}</div>
          <div className={styles.loginSubtitle}>{t('sppPortalForStaff')}</div>
        </div>
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.loginTitle}>{t('sppLogin')}</div>
          <div className={styles.field}>
            <label>{t('htEmail')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vas@email.com" required autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label>{t('stfPassword')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {authError && <div className={styles.authError}>{authError}</div>}
          <button type="submit" className={styles.loginBtn} style={{ background: brand }} disabled={authLoading}>
            {authLoading ? t('hkppLoggingIn') : `${t('hkppLogin')} →`}
          </button>
          <button type="button" className={styles.backLink} onClick={() => navigate(`/${slug}`)}>
            ← {t('sppBackToMenu')}
          </button>
        </form>
      </div>
    </div>
  )

  // ── PORTAL ─────────────────────────────────────────────────────
  const TABS = [
    { key: 'schedule',   icon: '📅', labelKey: 'sppTabSchedule' },
    { key: 'attendance', icon: '🕐', labelKey: 'attTitle' },
    { key: 'payroll',    icon: '💰', labelKey: 'payTypeSalary' },
    { key: 'absences',   icon: '🏖️', labelKey: 'sppTabAbsences' },
  ]

  const payrollFrom = payrollMonth + '-01'
  const [py, pm] = payrollMonth.split('-').map(Number)
  const payrollTo = new Date(py, pm, 0).toISOString().slice(0, 10)
  const wage = parseFloat(staff?.wage_amount || 0)
  const days = Math.ceil((new Date(payrollTo) - new Date(payrollFrom)) / 86400000) + 1
  let baseWage = 0
  if (staff?.wage_type === 'hourly') baseWage = 0
  else if (staff?.wage_type === 'weekly') baseWage = wage * Math.ceil(days / 7)
  else baseWage = wage
  const additions = payroll.filter(e => !['deduction','advance'].includes(e.type))
  const deductions = payroll.filter(e => ['deduction','advance'].includes(e.type))
  const totalAdd = additions.reduce((s,e) => s + parseFloat(e.amount||0), 0)
  const totalDed = deductions.reduce((s,e) => s + parseFloat(e.amount||0), 0)
  const neto = baseWage + totalAdd - totalDed

  const today = new Date().toISOString().slice(0,10)
  const thisWeek = schedules.filter(s => {
    const d = new Date(s.date)
    const now = new Date()
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7))
    const sun = new Date(mon); sun.setDate(mon.getDate()+6)
    return d >= mon && d <= sun
  })

  return (
    <div className={styles.portalPage}>
      {/* Header */}
      <div className={styles.portalHeader} style={{ background: brand }}>
        <div className={styles.portalHeaderTop}>
          <button className={styles.portalBack} onClick={() => navigate(`/${slug}`)}>← {t('sppMenu')}</button>
          <button className={styles.portalLogout} onClick={handleLogout}>{t('hkppLogout')}</button>
        </div>
        <div className={styles.portalInfo}>
          <div className={styles.portalAvatar}>
            {staff?.avatar_url
              ? <img src={staff.avatar_url} alt={staffName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : (staffName[0] || '?').toUpperCase()
            }
          </div>
          <div>
            <div className={styles.portalName}>{staffName || staff?.email}</div>
            <div className={styles.portalRole}>{staff?.position || t('stfStaffMember')} · {restaurant.name}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            style={activeTab === tab.key ? { borderBottomColor: brand, color: brand } : {}}
            onClick={() => setActiveTab(tab.key)}>
            {tab.icon} {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {dataLoading && <div className={styles.loadingInline}>{t('loading')}</div>}

        {/* RASPORED */}
        {activeTab === 'schedule' && !dataLoading && (
          <div>
            {thisWeek.length > 0 && (
              <div className={styles.weekCard}>
                <div className={styles.sectionTitle}>{t('schThisWeek')}</div>
                {thisWeek.map(s => (
                  <div key={s.id} className={styles.shiftRow}>
                    <div className={styles.shiftDay}>
                      {new Date(s.date).toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'numeric' })}
                      {s.date === today && <span className={styles.todayBadge}>{t('htToday')}</span>}
                    </div>
                    <div className={styles.shiftTime} style={{ color: brand }}>
                      {s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}
                    </div>
                    {s.note && <div className={styles.shiftNote}>{s.note}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.sectionTitle}>{t('sppAllShifts')} — {new Date().toLocaleDateString(dl, { month: 'long', year: 'numeric' })}</div>
            {schedules.length === 0
              ? <div className={styles.empty}>{t('sppNoShiftsMonth')}</div>
              : schedules.map(s => (
                <div key={s.id} className={styles.shiftRow}>
                  <div className={styles.shiftDay}>
                    {new Date(s.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'numeric' })}
                    {s.date === today && <span className={styles.todayBadge}>{t('htToday')}</span>}
                  </div>
                  <div className={styles.shiftTime} style={{ color: brand }}>
                    {s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* DOLASCI */}
        {activeTab === 'attendance' && !dataLoading && (
          <div>
            <div className={styles.sectionTitle}>{t('attTitle')} — {new Date().toLocaleDateString(dl, { month: 'long', year: 'numeric' })}</div>
            {attendance.length === 0
              ? <div className={styles.empty}>{t('sppNoAttendance')}</div>
              : attendance.map(a => {
                const hours = a.hours_worked ? parseFloat(a.hours_worked).toFixed(1) : '—'
                return (
                  <div key={a.id} className={styles.attRow}>
                    <div className={styles.attDate}>
                      {new Date(a.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'numeric' })}
                    </div>
                    <div className={styles.attTimes}>
                      <span>↓ {a.clock_in ? new Date(a.clock_in).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span>↑ {a.clock_out ? new Date(a.clock_out).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' }) : t('sppAtWork')}</span>
                    </div>
                    <div className={styles.attHours} style={{ color: brand }}>{hours !== '—' ? `${hours}h` : ''}</div>
                    {a.note && <div className={styles.attNote}>{a.note}</div>}
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ZARADA */}
        {activeTab === 'payroll' && !dataLoading && (
          <div>
            <div className={styles.monthPicker}>
              <label>{t('sppMonth')}:</label>
              <input type="month" value={payrollMonth}
                onChange={e => setPayrollMonth(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
            </div>

            <div className={styles.payKpi}>
              {[
                { label: t('payBaseSalary'), val: `€${baseWage.toFixed(2)}`, color: '#1a2e26' },
                { label: t('sppAdditions'), val: `+€${totalAdd.toFixed(2)}`, color: '#0d7a52' },
                { label: t('payDeductions'), val: `-€${totalDed.toFixed(2)}`, color: '#c0392b' },
                { label: t('sppNet'), val: `€${neto.toFixed(2)}`, color: brand },
              ].map((k, i) => (
                <div key={i} className={styles.payKpiCard}>
                  <div className={styles.payKpiLabel}>{k.label}</div>
                  <div className={styles.payKpiVal} style={{ color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>

            {payroll.length === 0
              ? <div className={styles.empty}>{t('sppNoEntriesMonth', { month: monthStr(payrollMonth, dl) })}</div>
              : payroll.map(e => {
                const et = ENTRY_TYPES[e.type]
                const isDed = ['deduction','advance'].includes(e.type)
                return (
                  <div key={e.id} className={styles.payRow}>
                    <span className={styles.payBadge} style={{ background: et?.bg, color: et?.color }}>{et && t(et.labelKey)}</span>
                    <div className={styles.payAmount} style={{ color: isDed ? '#c0392b' : '#0d7a52' }}>
                      {isDed ? '-' : '+'}€{parseFloat(e.amount).toFixed(2)}
                    </div>
                    <div className={styles.payMeta}>
                      {new Date(e.date).toLocaleDateString(dl)}
                      {e.note && <span> · {e.note}</span>}
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ODSUSTVA */}
        {activeTab === 'absences' && !dataLoading && (
          <div>
            {/* Godišnji odmor sažetak */}
            {(() => {
              const year = new Date().getFullYear()
              const vacUsed = absences.filter(a =>
                a.absence_type === 'vacation' && a.approved &&
                new Date(a.start_date).getFullYear() === year
              ).reduce((s,a) => s + (a.days || 0), 0)
              const vacTotal = staff?.vacation_days_total || 0
              return (
                <div className={styles.vacSummary}>
                  <div className={styles.vacItem}>
                    <div className={styles.vacNum}>{vacTotal}</div>
                    <div className={styles.vacLabel}>{t('sppTotalDays')}</div>
                  </div>
                  <div className={styles.vacItem}>
                    <div className={styles.vacNum} style={{ color: '#ba7517' }}>{vacUsed}</div>
                    <div className={styles.vacLabel}>{t('htUsed')}</div>
                  </div>
                  <div className={styles.vacItem}>
                    <div className={styles.vacNum} style={{ color: '#0d7a52' }}>{Math.max(0, vacTotal - vacUsed)}</div>
                    <div className={styles.vacLabel}>{t('sppRemaining')}</div>
                  </div>
                </div>
              )
            })()}

            <div className={styles.sectionTitle}>{t('sppAbsenceRecord')}</div>
            {absences.length === 0
              ? <div className={styles.empty}>{t('sppNoAbsences')}</div>
              : absences.map(a => {
                const at = ABSENCE_TYPES[a.absence_type] || ABSENCE_TYPES.other
                return (
                  <div key={a.id} className={styles.absRow}>
                    <span className={styles.payBadge} style={{ background: at.bg, color: at.color }}>{t(at.labelKey)}</span>
                    <div className={styles.absDateRange}>
                      {new Date(a.start_date).toLocaleDateString(dl)} – {new Date(a.end_date).toLocaleDateString(dl)}
                      <span style={{ color: '#8a9e96' }}> · {a.days === 1 ? t('sppDayOne', { n: a.days }) : t('sppDayOther', { n: a.days })}</span>
                    </div>
                    <span className={a.approved ? styles.approvedBadge : styles.pendingBadge}>
                      {a.approved ? `✓ ${t('sppApproved')}` : t('htPayPending')}
                    </span>
                  </div>
                )
              })
            }
          </div>
        )}
      </div>

      <div className={styles.footer}>
        Powered by <strong>rest.by.me</strong>
      </div>
    </div>
  )
}
