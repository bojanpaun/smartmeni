// ▶ Novi fajl: src/modules/hr/pages/StaffProfilePage.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { formatMoney, currencyMeta } from '../../../lib/currencies'
import styles from './StaffProfilePage.module.css'

const ENTRY_TYPES = [
  { key: 'salary',    labelKey: 'payTypeSalary',    color: '#0d7a52' },
  { key: 'daily',     labelKey: 'payTypeDaily',     color: '#3aaa70' },
  { key: 'bonus',     labelKey: 'payTypeBonus',     color: '#378add' },
  { key: 'overtime',  labelKey: 'payTypeOvertime',  color: '#7f77dd' },
  { key: 'deduction', labelKey: 'payTypeDeduction', color: '#c0392b' },
  { key: 'advance',   labelKey: 'payTypeAdvance',   color: '#ef9f27' },
]
function mStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function mEnd() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10) }

const CONTRACT_TYPE_KEYS = {
  permanent:'profContractPermanent', fixed:'profContractFixed',
  seasonal:'profContractSeasonal', probation:'profContractProbation', freelance:'profContractFreelance',
}
const EMPLOYMENT_TYPE_KEYS = {
  full_time:'profEmpFull', part_time:'profEmpPart', hourly:'stfWageHourly',
}
const HISTORY_ICONS = {
  hired:'🎉', promoted:'⬆️', wage_change:'💰', position_change:'🔄', warning:'⚠️', note:'📝', terminated:'🔚',
}
const ABSENCE_TYPES = {
  vacation: { labelKey:'sppVacation', color:'#0d7a52', bg:'#e0f5ec' },
  sick: { labelKey:'sppSick', color:'#BA7517', bg:'#FAEEDA' },
  unpaid: { labelKey:'profUnpaid', color:'#534AB7', bg:'#EEEDFE' },
  other: { labelKey:'htTypeOther', color:'#888780', bg:'#F1EFE8' },
}

export default function StaffProfilePage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant } = usePlatform()
  const money = (a) => formatMoney(a, restaurant?.currency, i18n.language)
  const sym = currencyMeta(restaurant?.currency).symbol
  const [staff, setStaff] = useState(null)
  const [roles, setRoles] = useState([])
  const [history, setHistory] = useState([])
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [showAbsenceForm, setShowAbsenceForm] = useState(false)
  const [showHistoryForm, setShowHistoryForm] = useState(false)

  const [basicForm, setBasicForm] = useState({})
  const [employForm, setEmployForm] = useState({})
  const [financeForm, setFinanceForm] = useState({})
  const [absenceForm, setAbsenceForm] = useState({ absence_type:'vacation', start_date:'', end_date:'', notes:'', approved:false })
  const [vacationYear, setVacationYear] = useState(new Date().getFullYear())
  // Payroll tab state — selektor mjeseca
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const payrollDateFrom = payrollMonth + '-01'
  const payrollDateTo = (() => {
    const [y, m] = payrollMonth.split('-').map(Number)
    return new Date(y, m, 0).toISOString().slice(0, 10)
  })()
  const [payrollEntries, setPayrollEntries] = useState([])
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [showPayrollForm, setShowPayrollForm] = useState(false)
  const [payrollForm, setPayrollForm] = useState({ type: 'salary', amount: '', date: new Date().toISOString().slice(0,10), note: '' })
  const [payrollSaving, setPayrollSaving] = useState(false)
  const [historyForm, setHistoryForm] = useState({ event_type:'note', description:'', event_date:new Date().toISOString().split('T')[0] })

  useEffect(() => { if (restaurant) loadAll() }, [staffId, restaurant])
  useEffect(() => { if (activeTab === 'payroll' && staffId) loadPayroll() }, [activeTab, payrollMonth, staffId])

  const [staffRoleIds, setStaffRoleIds] = useState([])
  const [staffRolesSaving, setStaffRolesSaving] = useState(false)

  const loadAll = async () => {
    const [{ data: s }, { data: r }, { data: h }, { data: a }, { data: sr }] = await Promise.all([
      supabase.from('staff').select('*, role:roles!role_id(name)').eq('id', staffId).single(),
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('staff_history').select('*').eq('staff_id', staffId).order('event_date', { ascending: false }),
      supabase.from('staff_absences').select('*').eq('staff_id', staffId).order('start_date', { ascending: false }),
      supabase.from('staff_roles').select('role_id').eq('staff_id', staffId),
    ])
    if (!s) { navigate('/admin/hr/staff'); return }
    setStaff(s); setRoles(r||[]); setHistory(h||[]); setAbsences(a||[])
    setStaffRoleIds((sr||[]).map(x => x.role_id))
    setBasicForm({ first_name:s.first_name||'', last_name:s.last_name||'', phone:s.phone||'', date_of_birth:s.date_of_birth||'', address:s.address||'', emergency_contact_name:s.emergency_contact_name||'', emergency_contact_phone:s.emergency_contact_phone||'' })
    setEmployForm({ position:s.position||'', contract_type:s.contract_type||'permanent', employment_type:s.employment_type||'full_time', start_date:s.start_date||'', end_date:s.end_date||'', role_id:s.role_id||'', wage_type:s.wage_type||'monthly', wage_amount:s.wage_amount||'', notes:s.notes||'' })
    setFinanceForm({ bank_account:s.bank_account||'', tax_id:s.tax_id||'', vacation_days_total:s.vacation_days_total||20, vacation_days_used:s.vacation_days_used||0 })
    setLoading(false)
  }

  const saveTab = async (updates) => {
    setSaving(true); setSaveError(null)
    // Konvertuj prazne string datume u null (PostgreSQL ne prihvata "" za DATE tip)
    const cleaned = Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [k, v === '' ? null : v])
    )
    const { data, error } = await supabase.from('staff').update(cleaned).eq('id', staffId).select('*, role:roles!role_id(name)').single()
    if (error) {
      console.error('Staff update error:', error)
      setSaveError(error.message)
      setSaving(false)
      return
    }
    if (data) setStaff(data)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const toggleStaffRole = async (roleId) => {
    setStaffRolesSaving(true)
    const has = staffRoleIds.includes(roleId)
    if (has) {
      await supabase.from('staff_roles').delete().eq('staff_id', staffId).eq('role_id', roleId)
      setStaffRoleIds(prev => prev.filter(id => id !== roleId))
    } else {
      await supabase.from('staff_roles').insert({ staff_id: staffId, role_id: roleId })
      setStaffRoleIds(prev => [...prev, roleId])
    }
    setStaffRolesSaving(false)
  }

  const saveAbsence = async (e) => {
    e.preventDefault()
    const days = Math.ceil((new Date(absenceForm.end_date) - new Date(absenceForm.start_date)) / (1000*60*60*24)) + 1
    await supabase.from('staff_absences').insert({ ...absenceForm, staff_id: staffId, restaurant_id: restaurant.id, days })
    const { data } = await supabase.from('staff_absences').select('*').eq('staff_id', staffId).order('start_date', { ascending: false })
    setAbsences(data||[]); setShowAbsenceForm(false)
    setAbsenceForm({ absence_type:'vacation', start_date:'', end_date:'', notes:'', approved:false })
  }

  const saveHistoryEvent = async (e) => {
    e.preventDefault()
    await supabase.from('staff_history').insert({ ...historyForm, staff_id: staffId, restaurant_id: restaurant.id })
    const { data } = await supabase.from('staff_history').select('*').eq('staff_id', staffId).order('event_date', { ascending: false })
    setHistory(data||[]); setShowHistoryForm(false)
    setHistoryForm({ event_type:'note', description:'', event_date:new Date().toISOString().split('T')[0] })
  }

  const deleteAbsence = async (id) => {
    if (!confirm(t('profDeleteConfirm'))) return
    await supabase.from('staff_absences').delete().eq('id', id)
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  const approveAbsence = async (absence) => {
    await supabase.from('staff_absences').update({ approved: true }).eq('id', absence.id)
    // Ako je godišnji odmor, ažurirati vacation_days_used
    if (absence.absence_type === 'vacation') {
      const current = parseFloat(staff.vacation_days_used || 0)
      const newUsed = current + (absence.days || 0)
      await supabase.from('staff').update({ vacation_days_used: newUsed }).eq('id', staffId)
      setStaff(s => ({ ...s, vacation_days_used: newUsed }))
      setFinanceForm(f => ({ ...f, vacation_days_used: newUsed }))
    }
    setAbsences(prev => prev.map(a => a.id === absence.id ? { ...a, approved: true } : a))
  }

  const rejectAbsence = async (id) => {
    await supabase.from('staff_absences').update({ approved: false }).eq('id', id)
    setAbsences(prev => prev.map(a => a.id === id ? { ...a, approved: false } : a))
  }

  if (loading) return <div className={styles.loading}>{t('profLoading')}</div>

  const initials = staff.first_name && staff.last_name ? `${staff.first_name[0]}${staff.last_name[0]}` : staff.email[0].toUpperCase()
  const displayName = staff.first_name && staff.last_name ? `${staff.first_name} ${staff.last_name}` : staff.email
  // ── Platna lista ─────────────────────────────────────────────
  const generatePayslip = (format = 'print') => {
    const days = Math.ceil((new Date(payrollDateTo) - new Date(payrollDateFrom)) / 86400000) + 1
    const wage = parseFloat(staff.wage_amount || 0)
    let base = 0
    if (staff.wage_type === 'hourly') base = 0
    else if (staff.wage_type === 'weekly') base = wage * Math.ceil(days / 7)
    else base = wage // Mjesečna = puna zarada za odabrani mjesec

    const additions = payrollEntries.filter(e => !['deduction','advance'].includes(e.type))
    const deductions = payrollEntries.filter(e => ['deduction','advance'].includes(e.type))
    const totalAdd = additions.reduce((s,e) => s + parseFloat(e.amount||0), 0)
    const totalDed = deductions.reduce((s,e) => s + parseFloat(e.amount||0), 0)
    const neto = base + totalAdd - totalDed

    const sName = (staff.first_name && staff.last_name) ? `${staff.first_name} ${staff.last_name}` : staff.email || '—'
    const rName = restaurant?.name || 'Restoran'
    const period = `${new Date(payrollDateFrom).toLocaleDateString(dl, { day: 'numeric', month: 'long', year: 'numeric' })} – ${new Date(payrollDateTo).toLocaleDateString(dl, { day: 'numeric', month: 'long', year: 'numeric' })}`
    const generated = new Date().toLocaleDateString(dl, { day: 'numeric', month: 'long', year: 'numeric' })

    const typeLabel = (key) => { const et = ENTRY_TYPES.find(x => x.key === key); return et ? t(et.labelKey) : key }

    const html = `<!DOCTYPE html>
<html lang="${i18n.language}">
<head>
<meta charset="UTF-8">
<title>${t('profPayslipTitle', { name: sName })}</title>
<style>
  @page { size: A4; margin: 2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a2e26; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d7a52; padding-bottom: 14px; margin-bottom: 20px; }
  .logo-area h1 { font-size: 20px; color: #0d7a52; font-weight: 700; }
  .logo-area p { font-size: 11px; color: #5a7a6a; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-info h2 { font-size: 16px; font-weight: 700; color: #1a2e26; }
  .doc-info p { font-size: 11px; color: #5a7a6a; }
  .employee-box { background: #f0f8f4; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 40px; }
  .employee-box .field label { font-size: 10px; color: #5a7a6a; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
  .employee-box .field span { font-size: 14px; font-weight: 700; color: #1a2e26; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #5a7a6a; border-bottom: 1px solid #c8e0d4; padding: 7px 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #e8f0ec; font-size: 13px; }
  .section-title { font-size: 12px; font-weight: 700; color: #0d7a52; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px; }
  .amount-pos { color: #0d7a52; font-weight: 700; }
  .amount-neg { color: #c0392b; font-weight: 700; }
  .summary { background: #1a2e26; color: #fff; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .summary .label { font-size: 12px; color: rgba(255,255,255,0.7); }
  .summary .val { font-size: 22px; font-weight: 700; }
  .kpi-row { display: flex; gap: 16px; margin-bottom: 20px; }
  .kpi-box { flex: 1; border: 1px solid #c8e0d4; border-radius: 8px; padding: 12px 14px; }
  .kpi-box .k-label { font-size: 10px; color: #5a7a6a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .kpi-box .k-val { font-size: 18px; font-weight: 700; color: #1a2e26; }
  .signatures { display: flex; gap: 40px; margin-top: 40px; }
  .sig { flex: 1; border-top: 1px solid #c8e0d4; padding-top: 8px; font-size: 11px; color: #5a7a6a; }
  .footer { text-align: center; font-size: 10px; color: #8a9e96; margin-top: 30px; border-top: 1px solid #e0ece6; padding-top: 10px; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>

<div class="no-print" style="background:#f0f8f4;padding:14px 20px;display:flex;gap:10px;align-items:center;margin-bottom:20px;border-radius:8px;">
  <span style="font-weight:700;color:#0d7a52;">${t('profPayslipGenerated')}</span>
  <button onclick="window.print()" style="margin-left:auto;padding:8px 20px;background:#0d7a52;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">${t('fpPrintSave')}</button>
  <button onclick="window.close()" style="padding:8px 14px;background:#fff;border:1px solid #c8e0d4;border-radius:8px;cursor:pointer;font-size:13px;">${t('fpClose')}</button>
</div>

<div class="header">
  <div class="logo-area">
    <h1>${rName}</h1>
    <p>${t('profPayslipForPeriod', { period })}</p>
  </div>
  <div class="doc-info">
    <h2>${t('profPayslipHeader')}</h2>
    <p>${t('profDate')}: ${generated}</p>
  </div>
</div>

<div class="employee-box">
  <div class="field"><label>${t('stfStaffMember')}</label><span>${sName}</span></div>
  <div class="field"><label>${t('profPosition')}</label><span>${staff.position || '—'}</span></div>
  <div class="field"><label>${t('profContractType')}</label><span>${staff.contract_type === 'permanent' ? t('profContractPermanent') : staff.contract_type === 'temporary' ? t('profContractTemp') : staff.contract_type || '—'}</span></div>
  <div class="field"><label>${t('stfWageType')}</label><span>${staff.wage_type === 'hourly' ? t('stfWageHourly') : staff.wage_type === 'weekly' ? t('stfWageWeekly') : t('stfWageMonthly')}</span></div>
</div>

<div class="kpi-row">
  <div class="kpi-box"><div class="k-label">${t('payBaseSalary')}</div><div class="k-val">${sym}${base.toFixed(2)}</div></div>
  <div class="kpi-box"><div class="k-label">${t('sppAdditions')}</div><div class="k-val" style="color:#0d7a52">+${sym}${totalAdd.toFixed(2)}</div></div>
  <div class="kpi-box"><div class="k-label">${t('payDeductions')}</div><div class="k-val" style="color:#c0392b">-${sym}${totalDed.toFixed(2)}</div></div>
</div>

${additions.length > 0 ? `
<div class="section-title">${t('profAdditionsToWage')}</div>
<table>
  <thead><tr><th>${t('flType')}</th><th>${t('hkpNote')}</th><th>${t('htDateHead')}</th><th style="text-align:right">${t('htAmount')}</th></tr></thead>
  <tbody>
    ${additions.map(e => `<tr>
      <td>${typeLabel(e.type)}</td>
      <td style="color:#5a7a6a">${e.note || '—'}</td>
      <td style="color:#5a7a6a">${new Date(e.date).toLocaleDateString(dl)}</td>
      <td class="amount-pos" style="text-align:right">+${sym}${parseFloat(e.amount).toFixed(2)}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${deductions.length > 0 ? `
<div class="section-title">${t('payDeductions')}</div>
<table>
  <thead><tr><th>${t('flType')}</th><th>${t('hkpNote')}</th><th>${t('htDateHead')}</th><th style="text-align:right">${t('htAmount')}</th></tr></thead>
  <tbody>
    ${deductions.map(e => `<tr>
      <td>${typeLabel(e.type)}</td>
      <td style="color:#5a7a6a">${e.note || '—'}</td>
      <td style="color:#5a7a6a">${new Date(e.date).toLocaleDateString(dl)}</td>
      <td class="amount-neg" style="text-align:right">-${sym}${parseFloat(e.amount).toFixed(2)}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

<div class="summary">
  <div>
    <div class="label">${t('profNetPayout')}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${period}</div>
  </div>
  <div class="val">${sym}${neto.toFixed(2)}</div>
</div>

<div class="signatures">
  <div class="sig">${t('profEmployerSig')}<br><br><br>___________________________<br>${rName}</div>
  <div class="sig">${t('profEmployeeSig')}<br><br><br>___________________________<br>${sName}</div>
</div>

<div class="footer">${t('profGeneratedVia', { date: generated })}</div>

</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(html)
    win.document.close()
  }

  const loadPayroll = async () => {
    if (!staffId) return
    setPayrollLoading(true)
    const { data } = await supabase
      .from('payroll_entries')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', payrollDateFrom)
      .lte('date', payrollDateTo)
      .order('date', { ascending: false })
    setPayrollEntries(data || [])
    setPayrollLoading(false)
  }

  const savePayrollEntry = async (e) => {
    e.preventDefault()
    setPayrollSaving(true)
    await supabase.from('payroll_entries').insert({
      restaurant_id: restaurant.id,
      staff_id: staffId,
      type: payrollForm.type,
      amount: parseFloat(payrollForm.amount) || 0,
      date: payrollForm.date,
      note: payrollForm.note || null,
    })
    setPayrollForm({ type: 'salary', amount: '', date: new Date().toISOString().slice(0,10), note: '' })
    setShowPayrollForm(false)
    setPayrollSaving(false)
    loadPayroll()
  }

  const deletePayrollEntry = async (id) => {
    await supabase.from('payroll_entries').delete().eq('id', id)
    setPayrollEntries(prev => prev.filter(e => e.id !== id))
  }

  const vacationDaysUsed = absences
    .filter(a => a.absence_type === 'vacation' && a.approved && new Date(a.start_date).getFullYear() === vacationYear)
    .reduce((sum, a) => sum + (a.days || 0), 0)
  const vacationLeft = (financeForm.vacation_days_total || 0) - vacationDaysUsed
  const yearsWorked = staff.start_date ? ((new Date() - new Date(staff.start_date)) / (1000*60*60*24*365)).toFixed(1) : null

  const TABS = [
    { key:'basic', labelKey:'profTabBasic' }, { key:'employ', labelKey:'profTabEmploy' },
    { key:'finance', labelKey:'profTabFinance' }, { key:'absence', labelKey:'sppTabAbsences' }, { key:'history', labelKey:'profTabHistory' }, { key:'payroll', labelKey:'payTitle' },
  ]

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/hr/staff')}>← {t('stfTitle')}</button>
        <span className={styles.breadSep}>/</span>
        <span>{displayName}</span>
      </div>

      {/* Header kartice */}
      <div className={styles.profileCard}>
        <div className={styles.avatarLg}>{staff.avatar_url ? <img src={staff.avatar_url} alt={displayName} /> : initials}</div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>{displayName}</div>
          <div className={styles.profileEmail}>{staff.email}</div>
          <div className={styles.profileBadges}>
            {staff.role?.name && <span className={styles.roleBadge}>{staff.role.name}</span>}
            {staff.position && <span className={styles.posBadge}>{staff.position}</span>}
            {staff.contract_type && <span className={styles.contractBadge}>{CONTRACT_TYPE_KEYS[staff.contract_type] ? t(CONTRACT_TYPE_KEYS[staff.contract_type]) : staff.contract_type}</span>}
          </div>
        </div>
        <div className={styles.profileStats}>
          {yearsWorked && (
            <div className={styles.statItem}>
              <div className={styles.statVal}>{yearsWorked}</div>
              <div className={styles.statLabel}>{t('profYearsWork')}</div>
            </div>
          )}
          {staff.wage_amount > 0 && (
            <div className={styles.statItem}>
              <div className={styles.statVal}>{money(staff.wage_amount)}</div>
              <div className={styles.statLabel}>{staff.wage_type==='hourly'?t('profPerHour'):staff.wage_type==='weekly'?t('profPerWeek'):t('profPerMonth')}</div>
            </div>
          )}
          <div className={styles.statItem}>
            <div className={styles.statVal}>{vacationLeft}</div>
            <div className={styles.statLabel}>{t('profVacDays')}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statVal} style={{color: staff.user_id ? '#0d7a52' : '#BA7517'}}>
              {staff.user_id ? '✓' : '⏳'}
            </div>
            <div className={styles.statLabel}>{staff.user_id ? t('htActive') : t('profWaiting')}</div>
          </div>
        </div>
      </div>

      {/* Tabovi */}
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button key={tab.key} className={`${styles.tab} ${activeTab===tab.key?styles.tabActive:''}`} onClick={() => setActiveTab(tab.key)}>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab sadržaj */}
      <div className={styles.tabBody}>

        {/* OSNOVNE INFO */}
        {activeTab === 'basic' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t('profPersonalData')}</div>
            <div className={styles.formGrid}>
              <Field label={t('profFirstName')}><input value={basicForm.first_name} onChange={e => setBasicForm(f=>({...f,first_name:e.target.value}))} placeholder={t('profFirstName')} /></Field>
              <Field label={t('profLastName')}><input value={basicForm.last_name} onChange={e => setBasicForm(f=>({...f,last_name:e.target.value}))} placeholder={t('profLastName')} /></Field>
              <Field label={t('htPhone')}><input value={basicForm.phone} onChange={e => setBasicForm(f=>({...f,phone:e.target.value}))} placeholder="+382 67 ..." /></Field>
              <Field label={t('htDateOfBirth')}><input type="date" value={basicForm.date_of_birth} onChange={e => setBasicForm(f=>({...f,date_of_birth:e.target.value}))} /></Field>
              <Field label={t('profAddress')} full><input value={basicForm.address} onChange={e => setBasicForm(f=>({...f,address:e.target.value}))} placeholder="Ulica, grad" /></Field>
            </div>
            <div className={styles.divider}>{t('profEmergencyContact')}</div>
            <div className={styles.formGrid}>
              <Field label={t('htFullName')}><input value={basicForm.emergency_contact_name} onChange={e => setBasicForm(f=>({...f,emergency_contact_name:e.target.value}))} placeholder="npr. Marija Paunović" /></Field>
              <Field label={t('htPhone')}><input value={basicForm.emergency_contact_phone} onChange={e => setBasicForm(f=>({...f,emergency_contact_phone:e.target.value}))} placeholder="+382 ..." /></Field>
            </div>
            <SaveRow onSave={() => saveTab(basicForm)} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* ZAPOSLENJE */}
        {activeTab === 'employ' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t('profEmployData')}</div>
            <div className={styles.formGrid}>
              <Field label={t('profPosition')}><input value={employForm.position} onChange={e => setEmployForm(f=>({...f,position:e.target.value}))} placeholder="npr. Šef kuhinje" /></Field>
              <Field label={t('profPrimaryRole')}>
                <select value={employForm.role_id} onChange={e => setEmployForm(f=>({...f,role_id:e.target.value}))}>
                  <option value="">{t('stfNoRole')}</option>
                  {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  {t('profPortalRoles')} {staffRolesSaving && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {t('profSavingDots')}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                  {t('profSelectRoles')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {roles.map(r => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7,
                      background: staffRoleIds.includes(r.id) ? '#f0fdf4' : '#f9fafb',
                      border: `1.5px solid ${staffRoleIds.includes(r.id) ? '#86efac' : '#e5e7eb'}`,
                      borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
                      fontSize: 13, fontWeight: 500, color: '#374151', transition: 'all 0.15s' }}>
                      <input
                        type="checkbox"
                        checked={staffRoleIds.includes(r.id)}
                        onChange={() => toggleStaffRole(r.id)}
                        style={{ accentColor: '#0d7a52' }}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
              <Field label={t('profContractTypeSel')}>
                <select value={employForm.contract_type} onChange={e => setEmployForm(f=>({...f,contract_type:e.target.value}))}>
                  {Object.entries(CONTRACT_TYPE_KEYS).map(([k,key])=><option key={k} value={k}>{t(key)}</option>)}
                </select>
              </Field>
              <Field label={t('profWorkTime')}>
                <select value={employForm.employment_type} onChange={e => setEmployForm(f=>({...f,employment_type:e.target.value}))}>
                  {Object.entries(EMPLOYMENT_TYPE_KEYS).map(([k,key])=><option key={k} value={k}>{t(key)}</option>)}
                </select>
              </Field>
              <Field label={t('profStartDate')}><input type="date" value={employForm.start_date} onChange={e => setEmployForm(f=>({...f,start_date:e.target.value}))} /></Field>
              <Field label={t('profEndDate')}><input type="date" value={employForm.end_date} onChange={e => setEmployForm(f=>({...f,end_date:e.target.value}))} /></Field>
              <Field label={t('stfWageType')}>
                <select value={employForm.wage_type} onChange={e => setEmployForm(f=>({...f,wage_type:e.target.value}))}>
                  <option value="monthly">{t('stfWageMonthly')}</option>
                  <option value="weekly">{t('stfWageWeekly')}</option>
                  <option value="hourly">{t('stfWageHourly')}</option>
                </select>
              </Field>
              <Field label={t('profWageAmount')}><input type="number" min="0" step="0.01" value={employForm.wage_amount} onChange={e => setEmployForm(f=>({...f,wage_amount:e.target.value}))} placeholder="0.00" /></Field>
              <Field label={t('profNotes')} full><textarea rows={3} value={employForm.notes} onChange={e => setEmployForm(f=>({...f,notes:e.target.value}))} placeholder="Interne napomene..." /></Field>
            </div>
            <SaveRow onSave={() => saveTab({...employForm, wage_amount: parseFloat(employForm.wage_amount)||0})} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* FINANSIJE */}
        {activeTab === 'finance' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t('profFinanceData')}</div>
            <div className={styles.formGrid}>
              <Field label={t('profBankAccount')} full><input value={financeForm.bank_account} onChange={e => setFinanceForm(f=>({...f,bank_account:e.target.value}))} placeholder="ME25 ..." /></Field>
              <Field label={t('profTaxId')} full><input value={financeForm.tax_id} onChange={e => setFinanceForm(f=>({...f,tax_id:e.target.value}))} placeholder="Poreski identifikacioni broj" /></Field>
            </div>

            <SaveRow onSave={() => saveTab(financeForm)} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* ODSUSTVA */}
        {activeTab === 'absence' && (
          <div className={styles.card}>
            <div className={styles.vacationTracker}>
              <div className={styles.vacTrackerTitle}>
                {t('sppVacation')}
                <select
                  value={vacationYear}
                  onChange={e => setVacationYear(parseInt(e.target.value))}
                  style={{ marginLeft: 12, padding: '3px 8px', borderRadius: 7, border: '1px solid #d0e4dc', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
                >
                  {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}.</option>
                  ))}
                </select>
              </div>
              <div className={styles.vacTrackerRow}>
                <div className={styles.vacCard}><div className={styles.vacNum}>{financeForm.vacation_days_total}</div><div className={styles.vacLabel}>{t('sppTotalDays')}</div></div>
                <div className={styles.vacCard}><div className={styles.vacNum} style={{color:'#BA7517'}}>{vacationDaysUsed}</div><div className={styles.vacLabel}>{t('htUsed')}</div></div>
                <div className={styles.vacCard}><div className={styles.vacNum} style={{color:'#0d7a52'}}>{vacationLeft}</div><div className={styles.vacLabel}>{t('sppRemaining')}</div></div>
                <div className={styles.vacEditField}>
                  <label>{t('profVacTotalDays')}</label>
                  <input type="number" min="0" value={financeForm.vacation_days_total} onChange={e => setFinanceForm(f=>({...f,vacation_days_total:parseInt(e.target.value)||0}))} />
                  <button className={styles.btnSaveSmall} onClick={() => saveTab({vacation_days_total: financeForm.vacation_days_total})}>{t('save')}</button>
                </div>
              </div>
            </div>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>{t('sppAbsenceRecord')}</div>
              <button className={styles.btnPrimary} onClick={() => setShowAbsenceForm(v=>!v)}>+ {t('rplAddShort')}</button>
            </div>
            {showAbsenceForm && (
              <form onSubmit={saveAbsence} className={styles.inlineForm}>
                <div className={styles.formGrid}>
                  <Field label={t('flType')}>
                    <select value={absenceForm.absence_type} onChange={e=>setAbsenceForm(f=>({...f,absence_type:e.target.value}))}>
                      {Object.entries(ABSENCE_TYPES).map(([k,v])=><option key={k} value={k}>{t(v.labelKey)}</option>)}
                    </select>
                  </Field>
                  <Field label={t('sppApproved')}>
                    <select value={absenceForm.approved} onChange={e=>setAbsenceForm(f=>({...f,approved:e.target.value==='true'}))}>
                      <option value="true">{t('profYes')}</option><option value="false">{t('profNo')}</option>
                    </select>
                  </Field>
                  <Field label={t('profFromDate')}><input type="date" required value={absenceForm.start_date} onChange={e=>setAbsenceForm(f=>({...f,start_date:e.target.value}))} /></Field>
                  <Field label={t('profToDate')}><input type="date" required value={absenceForm.end_date} onChange={e=>setAbsenceForm(f=>({...f,end_date:e.target.value}))} /></Field>
                  <Field label={t('hkpNote')} full><input value={absenceForm.notes} onChange={e=>setAbsenceForm(f=>({...f,notes:e.target.value}))} placeholder="Opcionalno" /></Field>
                </div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowAbsenceForm(false)}>{t('cancel')}</button>
                  <button type="submit" className={styles.btnPrimary}>{t('save')}</button>
                </div>
              </form>
            )}
            {absences.length === 0 ? <div className={styles.empty}>{t('sppNoAbsences')}</div> : (
              <div className={styles.absenceList}>
                {absences.map(a => (
                  <div key={a.id} className={styles.absenceItem}>
                    <span className={styles.absenceTag} style={{background:ABSENCE_TYPES[a.absence_type]?.bg,color:ABSENCE_TYPES[a.absence_type]?.color}}>{ABSENCE_TYPES[a.absence_type] && t(ABSENCE_TYPES[a.absence_type].labelKey)}</span>
                    <div className={styles.absenceDates}>
                      {new Date(a.start_date).toLocaleDateString(dl)} — {new Date(a.end_date).toLocaleDateString(dl)}
                      <span className={styles.absenceDays}> · {a.days===1?t('sppDayOne',{n:a.days}):t('sppDayOther',{n:a.days})}</span>
                    </div>
                    <div className={styles.absenceActions}>
                      {a.approved === true  && <span className={styles.approvedBadge}>✓ {t('sppApproved')}</span>}
                      {a.approved === null  && <span className={styles.pendingBadge}>{t('htPayPending')}</span>}
                      {a.approved === false && <span className={styles.rejectedBadge}>✗ {t('profRejected')}</span>}
                      {a.approved === null && (
                        <button className={styles.btnApprove} onClick={() => approveAbsence(a)}>{t('payApprove')}</button>
                      )}
                      {a.approved === null && (
                        <button className={styles.btnReject} onClick={() => rejectAbsence(a.id)}>{t('profReject')}</button>
                      )}
                      {a.approved === true && (
                        <button className={styles.btnReject} onClick={() => rejectAbsence(a.id)}>{t('profCancel2')}</button>
                      )}
                      <button className={styles.delBtn} onClick={() => deleteAbsence(a.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ZARADE */}
        {activeTab === 'payroll' && (
          <div className={styles.card}>
            {/* Period filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="month" value={payrollMonth}
                onChange={e => setPayrollMonth(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => generatePayslip()}
                  title={t('profGeneratePayslipTitle')}
                >
                  📄 {t('profPayslip')}
                </button>
                <button className={styles.btnPrimary}
                  onClick={() => setShowPayrollForm(v => !v)}>
                  + {t('payAddEntry')}
                </button>
              </div>
            </div>

            {/* KPI za period */}
            {(() => {
              const days = Math.ceil((new Date(payrollDateTo) - new Date(payrollDateFrom)) / 86400000) + 1
              const wage = parseFloat(staff.wage_amount || 0)
              let base = 0
              if (staff.wage_type === 'hourly') base = 0
              else if (staff.wage_type === 'weekly') base = wage * Math.ceil(days / 7)
              else base = wage // Puna mjesečna zarada
              const extras = payrollEntries.filter(e => !['deduction','advance'].includes(e.type)).reduce((s,e) => s + parseFloat(e.amount||0), 0)
              const deductions = payrollEntries.filter(e => ['deduction','advance'].includes(e.type)).reduce((s,e) => s + parseFloat(e.amount||0), 0)
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: t('payBaseSalary'), val: money(base), color: '#0d7a52' },
                    { label: t('sppAdditions'), val: `+${money(extras)}`, color: '#378add' },
                    { label: t('payDeductions'), val: `-${money(deductions)}`, color: '#c0392b' },
                    { label: t('flTotal'), val: money(base + extras - deductions), color: '#1a2e26' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: '#f8fbf9', borderRadius: 10, padding: '12px 14px', border: '1px solid #e0ece6' }}>
                      <div style={{ fontSize: 11, color: '#8a9e96', marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Forma za dodavanje */}
            {showPayrollForm && (
              <form onSubmit={savePayrollEntry} style={{ background: '#f0f8f4', borderRadius: 12, padding: '16px', marginBottom: 16, border: '1px solid #c8e8d8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#5a7a6a', display: 'block', marginBottom: 4 }}>{t('flType')}</label>
                    <select value={payrollForm.type} onChange={e => setPayrollForm(f => ({ ...f, type: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
                      {ENTRY_TYPES.map(et => <option key={et.key} value={et.key}>{t(et.labelKey)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#5a7a6a', display: 'block', marginBottom: 4 }}>{t('stfAmountEur')}</label>
                    <input type="number" min="0" step="0.01" required value={payrollForm.amount}
                      onChange={e => setPayrollForm(f => ({ ...f, amount: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#5a7a6a', display: 'block', marginBottom: 4 }}>{t('htDateHead')}</label>
                    <input type="date" required value={payrollForm.date}
                      onChange={e => setPayrollForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: '#5a7a6a', display: 'block', marginBottom: 4 }}>{t('hkpNote')}</label>
                  <input value={payrollForm.note} onChange={e => setPayrollForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Opcionalno"
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0e4dc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowPayrollForm(false)}>{t('cancel')}</button>
                  <button type="submit" className={styles.btnPrimary} disabled={payrollSaving}>
                    {payrollSaving ? t('saving') : t('payAddEntry')}
                  </button>
                </div>
              </form>
            )}

            {/* Lista stavki */}
            {payrollLoading
              ? <div style={{ color: '#8a9e96', fontSize: 13, padding: 16, textAlign: 'center' }}>{t('loading')}</div>
              : payrollEntries.length === 0
              ? <div className={styles.empty}>{t('payNoEntries')}</div>
              : (
                <div>
                  {payrollEntries.map(entry => {
                    const et = ENTRY_TYPES.find(x => x.key === entry.type)
                    const isDeduction = ['deduction','advance'].includes(entry.type)
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0f5f2' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: et?.color + '22', color: et?.color }}>
                          {et && t(et.labelKey)}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isDeduction ? '#c0392b' : '#0d7a52' }}>
                            {isDeduction ? '-' : '+'}{money(entry.amount)}
                          </div>
                          {entry.note && <div style={{ fontSize: 11, color: '#8a9e96' }}>{entry.note}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: '#8a9e96' }}>
                          {new Date(entry.date).toLocaleDateString(dl)}
                        </div>
                        <button onClick={() => deletePayrollEntry(entry.id)}
                          style={{ background: 'none', border: 'none', color: '#c0b0b0', cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 4 }}
                          title={t('htDelete')}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* HISTORIJA */}
        {activeTab === 'history' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>{t('profEmploymentHistory')}</div>
              <button className={styles.btnPrimary} onClick={() => setShowHistoryForm(v=>!v)}>+ {t('profAddRecord')}</button>
            </div>
            {showHistoryForm && (
              <form onSubmit={saveHistoryEvent} className={styles.inlineForm}>
                <div className={styles.formGrid}>
                  <Field label={t('profEventType')}>
                    <select value={historyForm.event_type} onChange={e=>setHistoryForm(f=>({...f,event_type:e.target.value}))}>
                      <option value="note">📝 {t('profEvtNote')}</option>
                      <option value="promoted">⬆️ {t('profEvtPromoted')}</option>
                      <option value="wage_change">💰 {t('profEvtWage')}</option>
                      <option value="position_change">🔄 {t('profEvtPosition')}</option>
                      <option value="warning">⚠️ {t('profEvtWarning')}</option>
                      <option value="terminated">🔚 {t('profEvtTerminated')}</option>
                    </select>
                  </Field>
                  <Field label={t('htDateHead')}><input type="date" value={historyForm.event_date} onChange={e=>setHistoryForm(f=>({...f,event_date:e.target.value}))} /></Field>
                  <Field label={`${t('flDesc')} *`} full><input required value={historyForm.description} onChange={e=>setHistoryForm(f=>({...f,description:e.target.value}))} placeholder="Kratak opis..." /></Field>
                </div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowHistoryForm(false)}>{t('cancel')}</button>
                  <button type="submit" className={styles.btnPrimary}>{t('save')}</button>
                </div>
              </form>
            )}
            {history.length === 0 ? <div className={styles.empty}>{t('profNoHistory')}</div> : (
              <div className={styles.timeline}>
                {history.map(h => (
                  <div key={h.id} className={styles.tlItem}>
                    <div className={styles.tlDot}>{HISTORY_ICONS[h.event_type]||'📝'}</div>
                    <div className={styles.tlContent}>
                      <div className={styles.tlDesc}>{h.description}</div>
                      <div className={styles.tlDate}>{new Date(h.event_date).toLocaleDateString(dl, {day:'numeric', month:'long', year:'numeric'})}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, full }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: full ? '1 / -1' : undefined }}>
      <label style={{ fontSize:12, fontWeight:500, color:'#5a7a6a' }}>{label}</label>
      {children}
    </div>
  )
}

function SaveRow({ onSave, saving, saved, error }) {
  const { t } = useTranslation('admin')
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:12, marginTop:16, paddingTop:12, borderTop:'1px solid #f0f5f2' }}>
      {error && <span style={{ color:'#c0392b', fontSize:12 }}>{t('htErr')}: {error}</span>}
      <button
        style={{ padding:'10px 20px', background: saving ? '#888' : '#0d7a52', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'DM Sans, sans-serif' }}
        onClick={onSave} disabled={saving}
      >
        {saving ? t('saving') : saved ? `✓ ${t('profSaved')}` : t('profSaveChanges')}
      </button>
    </div>
  )
}
