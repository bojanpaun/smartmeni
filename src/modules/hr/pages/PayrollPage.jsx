// ▶ Novi fajl: src/modules/hr/pages/PayrollPage.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './PayrollPage.module.css'

const ENTRY_TYPES = [
  { key: 'daily',     label: 'Dnevnica',    color: '#0d7a52' },
  { key: 'bonus',     label: 'Bonus',       color: '#378add' },
  { key: 'deduction', label: 'Odbitak',     color: '#c0392b' },
  { key: 'overtime',  label: 'Prekovremeni', color: '#7f77dd' },
  { key: 'advance',   label: 'Akontacija',  color: '#ef9f27' },
]

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function monthEnd() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function PayrollPage() {
  const { restaurant, user, isOwner, isSuperAdmin } = usePlatform()
  const isAdmin = isOwner() || isSuperAdmin()

  const [staff, setStaff] = useState([])
  const [entries, setEntries] = useState([])
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState('all')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('entries') // entries | periods

  const [form, setForm] = useState({
    staff_id: '',
    date: today(),
    type: 'daily',
    amount: '',
    note: '',
  })

  useEffect(() => {
    if (restaurant) loadData()
  }, [restaurant, selectedStaff, dateFrom, dateTo])

  const loadData = async () => {
    setLoading(true)
    let staffQ = supabase.from('staff').select('id, email, wage_type, wage_amount, user_profiles(full_name)')
      .eq('restaurant_id', restaurant.id).eq('is_active', true).order('email')

    let entriesQ = supabase.from('payroll_entries')
      .select('*, staff(email, user_profiles(full_name))')
      .eq('restaurant_id', restaurant.id)
      .gte('date', dateFrom).lte('date', dateTo)
      .order('date', { ascending: false })

    let periodsQ = supabase.from('payroll_periods')
      .select('*, staff(email, user_profiles(full_name))')
      .eq('restaurant_id', restaurant.id)
      .order('period_start', { ascending: false })

    if (selectedStaff !== 'all') {
      entriesQ = entriesQ.eq('staff_id', selectedStaff)
      periodsQ = periodsQ.eq('staff_id', selectedStaff)
    }

    const [{ data: s }, { data: e }, { data: p }] = await Promise.all([staffQ, entriesQ, periodsQ])
    setStaff(s || [])
    setEntries(e || [])
    setPeriods(p || [])
    setLoading(false)
  }

  const saveEntry = async (e) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('payroll_entries').insert({
      restaurant_id: restaurant.id,
      staff_id: form.staff_id,
      date: form.date,
      type: form.type,
      amount: parseFloat(form.amount),
      note: form.note || null,
      created_by: user.id,
    })
    await loadData()
    setSaving(false)
    setShowEntryForm(false)
    setForm({ staff_id: '', date: today(), type: 'daily', amount: '', note: '' })
  }

  const deleteEntry = async (id) => {
    if (!confirm('Obrisati ovu stavku?')) return
    await supabase.from('payroll_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Generiši platni list za period
  const generatePeriod = async (staffMember) => {
    const periodEntries = entries.filter(e => e.staff_id === staffMember.id)
    const attendance = await supabase.from('attendance')
      .select('hours_worked, date').eq('staff_id', staffMember.id)
      .gte('date', dateFrom).lte('date', dateTo)

    const hours = (attendance.data || []).reduce((s, a) => s + (parseFloat(a.hours_worked) || 0), 0)
    const days = (attendance.data || []).filter(a => a.hours_worked > 0).length

    const days_count = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    const wage = parseFloat(staffMember.wage_amount || 0)
    let baseSalary = 0
    if (staffMember.wage_type === 'hourly') baseSalary = wage * hours
    else if (staffMember.wage_type === 'weekly') baseSalary = wage * (days_count / 7)
    else baseSalary = wage * (days_count / 30)

    const dailyTotal = periodEntries.filter(e => e.type === 'daily').reduce((s, e) => s + parseFloat(e.amount), 0)
    const bonusTotal = periodEntries.filter(e => e.type === 'bonus' || e.type === 'overtime').reduce((s, e) => s + parseFloat(e.amount), 0)
    const deductionTotal = periodEntries.filter(e => e.type === 'deduction' || e.type === 'advance').reduce((s, e) => s + parseFloat(e.amount), 0)
    const grossTotal = baseSalary + dailyTotal + bonusTotal - deductionTotal

    const { data } = await supabase.from('payroll_periods').upsert({
      restaurant_id: restaurant.id,
      staff_id: staffMember.id,
      period_start: dateFrom,
      period_end: dateTo,
      base_salary: baseSalary,
      daily_total: dailyTotal,
      bonus_total: bonusTotal,
      deduction_total: deductionTotal,
      gross_total: grossTotal,
      hours_worked: hours,
      days_worked: days,
      status: 'draft',
    }, { onConflict: 'restaurant_id,staff_id,period_start,period_end' }).select('*, staff(email, user_profiles(full_name))').single()

    setPeriods(prev => {
      const filtered = prev.filter(p => !(p.staff_id === staffMember.id && p.period_start === dateFrom && p.period_end === dateTo))
      return [data, ...filtered]
    })
    setActiveTab('periods')
  }

  const updatePeriodStatus = async (id, status) => {
    await supabase.from('payroll_periods').update({ status }).eq('id', id)
    setPeriods(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  const staffName = (s) => s?.user_profiles?.full_name || s?.email?.split('@')[0] || '—'
  const typeInfo = (key) => ENTRY_TYPES.find(t => t.key === key) || ENTRY_TYPES[0]

  // Sumarne statistike
  const totals = {
    daily: entries.filter(e => e.type === 'daily').reduce((s, e) => s + parseFloat(e.amount), 0),
    bonus: entries.filter(e => e.type === 'bonus').reduce((s, e) => s + parseFloat(e.amount), 0),
    overtime: entries.filter(e => e.type === 'overtime').reduce((s, e) => s + parseFloat(e.amount), 0),
    deduction: entries.filter(e => e.type === 'deduction').reduce((s, e) => s + parseFloat(e.amount), 0),
    advance: entries.filter(e => e.type === 'advance').reduce((s, e) => s + parseFloat(e.amount), 0),
  }

  if (loading) return <div className={styles.loading}>Učitavanje zarada...</div>

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Zarade</div>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={() => setShowEntryForm(true)}>
            + Nova stavka
          </button>
        )}
      </div>

      {/* Filteri */}
      <div className={styles.filters}>
        <select className={styles.filterSelect} value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
          <option value="all">Svi zaposleni</option>
          {staff.map(s => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
        </select>
        <input type="date" className={styles.filterDate} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className={styles.filterSep}>—</span>
        <input type="date" className={styles.filterDate} value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      {/* Sumarni kartice */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Dnevnice</div>
          <div className={styles.summaryVal}>€{totals.daily.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Bonusi</div>
          <div className={styles.summaryVal} style={{ color: '#378add' }}>€{totals.bonus.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Prekovremeni</div>
          <div className={styles.summaryVal} style={{ color: '#7f77dd' }}>€{(totals.overtime).toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Odbitci</div>
          <div className={styles.summaryVal} style={{ color: '#c0392b' }}>-€{(totals.deduction + totals.advance).toFixed(2)}</div>
        </div>
      </div>

      {/* Tabovi */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'entries' ? styles.tabActive : ''}`} onClick={() => setActiveTab('entries')}>
          Stavke ({entries.length})
        </button>
        <button className={`${styles.tab} ${activeTab === 'periods' ? styles.tabActive : ''}`} onClick={() => setActiveTab('periods')}>
          Platni listovi ({periods.length})
        </button>
      </div>

      {/* Stavke */}
      {activeTab === 'entries' && (
        <div className={styles.entriesList}>
          {entries.length === 0 ? (
            <div className={styles.empty}>Nema stavki za odabrani period.</div>
          ) : (
            entries.map(entry => {
              const t = typeInfo(entry.type)
              return (
                <div key={entry.id} className={styles.entryRow}>
                  <div className={styles.entryType}>
                    <span className={styles.typePill} style={{ background: t.color + '20', color: t.color }}>{t.label}</span>
                  </div>
                  <div className={styles.entryStaff}>{staffName(entry.staff)}</div>
                  <div className={styles.entryDate}>{entry.date}</div>
                  <div className={styles.entryNote}>{entry.note || '—'}</div>
                  <div className={styles.entryAmount} style={{ color: entry.type === 'deduction' || entry.type === 'advance' ? '#c0392b' : '#0d7a52' }}>
                    {entry.type === 'deduction' || entry.type === 'advance' ? '-' : '+'}€{parseFloat(entry.amount).toFixed(2)}
                  </div>
                  {isAdmin && (
                    <button className={styles.entryDelete} onClick={() => deleteEntry(entry.id)}>✕</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Platni listovi */}
      {activeTab === 'periods' && (
        <div>
          {isAdmin && (
            <div className={styles.generateRow}>
              <span className={styles.generateLabel}>Generiši platne listove za period:</span>
              <div className={styles.generateBtns}>
                {staff.map(s => (
                  <button key={s.id} className={styles.btnGenerate} onClick={() => generatePeriod(s)}>
                    {staffName(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {periods.length === 0 ? (
            <div className={styles.empty}>Nema platnih listova. Generiši ih iznad.</div>
          ) : (
            <div className={styles.periodsList}>
              {periods.map(period => (
                <div key={period.id} className={styles.periodCard}>
                  <div className={styles.periodHeader}>
                    <div>
                      <div className={styles.periodName}>{staffName(period.staff)}</div>
                      <div className={styles.periodDates}>{period.period_start} — {period.period_end}</div>
                    </div>
                    <span className={`${styles.statusPill} ${styles[`status-${period.status}`]}`}>
                      {period.status === 'draft' ? 'Nacrt' : period.status === 'approved' ? 'Odobreno' : 'Plaćeno'}
                    </span>
                  </div>
                  <div className={styles.periodGrid}>
                    <div><div className={styles.pgLabel}>Osnovna plata</div><div className={styles.pgVal}>€{parseFloat(period.base_salary).toFixed(2)}</div></div>
                    <div><div className={styles.pgLabel}>Dnevnice</div><div className={styles.pgVal}>+€{parseFloat(period.daily_total).toFixed(2)}</div></div>
                    <div><div className={styles.pgLabel}>Bonusi</div><div className={styles.pgVal} style={{color:'#378add'}}>+€{parseFloat(period.bonus_total).toFixed(2)}</div></div>
                    <div><div className={styles.pgLabel}>Odbitci</div><div className={styles.pgVal} style={{color:'#c0392b'}}>-€{parseFloat(period.deduction_total).toFixed(2)}</div></div>
                    <div><div className={styles.pgLabel}>Sati rada</div><div className={styles.pgVal}>{parseFloat(period.hours_worked).toFixed(1)}h</div></div>
                    <div><div className={styles.pgLabel}>Dana rada</div><div className={styles.pgVal}>{period.days_worked}</div></div>
                  </div>
                  <div className={styles.periodTotal}>
                    <span>Ukupno bruto</span>
                    <span className={styles.periodTotalVal}>€{parseFloat(period.gross_total).toFixed(2)}</span>
                  </div>
                  {isAdmin && period.status !== 'paid' && (
                    <div className={styles.periodActions}>
                      {period.status === 'draft' && (
                        <button className={styles.btnApprove} onClick={() => updatePeriodStatus(period.id, 'approved')}>
                          Odobri
                        </button>
                      )}
                      {period.status === 'approved' && (
                        <button className={styles.btnPay} onClick={() => updatePeriodStatus(period.id, 'paid')}>
                          Označi kao plaćeno
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal forma za novu stavku */}
      {showEntryForm && (
        <div className={styles.overlay} onClick={() => setShowEntryForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Nova stavka zarade</div>
              <button className={styles.modalClose} onClick={() => setShowEntryForm(false)}>✕</button>
            </div>
            <form onSubmit={saveEntry} className={styles.form}>
              <div className={styles.field}>
                <label>Zaposlenik *</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} required>
                  <option value="">— Odaberi —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{staffName(s)}</option>)}
                </select>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Tip *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {ENTRY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Datum *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>
              <div className={styles.field}>
                <label>Iznos (€) *</label>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
              </div>
              <div className={styles.field}>
                <label>Napomena</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Npr. bonus za vikend, zamjena..." />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowEntryForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnAdd} disabled={saving}>{saving ? 'Čuvanje...' : 'Dodaj stavku'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
