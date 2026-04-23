// ▶ Novi fajl: src/modules/hr/pages/StaffProfilePage.jsx

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './StaffProfilePage.module.css'

const CONTRACT_TYPES = {
  permanent:'Stalni ugovor', fixed:'Ugovor na određeno',
  seasonal:'Sezonski', probation:'Probni rad', freelance:'Ugovor o djelu',
}
const EMPLOYMENT_TYPES = {
  full_time:'Puno radno vrijeme', part_time:'Pola radnog vremena', hourly:'Po satu',
}
const HISTORY_ICONS = {
  hired:'🎉', promoted:'⬆️', wage_change:'💰', position_change:'🔄', warning:'⚠️', note:'📝', terminated:'🔚',
}
const ABSENCE_TYPES = {
  vacation: { label:'Godišnji odmor', color:'#0d7a52', bg:'#e0f5ec' },
  sick: { label:'Bolovanje', color:'#BA7517', bg:'#FAEEDA' },
  unpaid: { label:'Neplaćeno', color:'#534AB7', bg:'#EEEDFE' },
  other: { label:'Ostalo', color:'#888780', bg:'#F1EFE8' },
}

export default function StaffProfilePage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const { restaurant } = usePlatform()
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
  const [historyForm, setHistoryForm] = useState({ event_type:'note', description:'', event_date:new Date().toISOString().split('T')[0] })

  useEffect(() => { if (restaurant) loadAll() }, [staffId, restaurant])

  const loadAll = async () => {
    const [{ data: s }, { data: r }, { data: h }, { data: a }] = await Promise.all([
      supabase.from('staff').select('*, role:roles(name)').eq('id', staffId).single(),
      supabase.from('roles').select('*').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('staff_history').select('*').eq('staff_id', staffId).order('event_date', { ascending: false }),
      supabase.from('staff_absences').select('*').eq('staff_id', staffId).order('start_date', { ascending: false }),
    ])
    if (!s) { navigate('/admin/hr/staff'); return }
    setStaff(s); setRoles(r||[]); setHistory(h||[]); setAbsences(a||[])
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
    const { data, error } = await supabase.from('staff').update(cleaned).eq('id', staffId).select('*, role:roles(name)').single()
    if (error) {
      console.error('Staff update error:', error)
      setSaveError(error.message)
      setSaving(false)
      return
    }
    if (data) setStaff(data)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
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
    if (!confirm('Obrisati?')) return
    await supabase.from('staff_absences').delete().eq('id', id)
    setAbsences(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className={styles.loading}>Učitavanje profila...</div>

  const initials = staff.first_name && staff.last_name ? `${staff.first_name[0]}${staff.last_name[0]}` : staff.email[0].toUpperCase()
  const displayName = staff.first_name && staff.last_name ? `${staff.first_name} ${staff.last_name}` : staff.email
  const vacationDaysUsed = absences
    .filter(a => a.absence_type === 'vacation' && a.approved)
    .reduce((sum, a) => sum + (a.days || 0), 0)
  const vacationLeft = (financeForm.vacation_days_total || 0) - vacationDaysUsed
  const yearsWorked = staff.start_date ? ((new Date() - new Date(staff.start_date)) / (1000*60*60*24*365)).toFixed(1) : null

  const TABS = [
    { key:'basic', label:'Osnovne info' }, { key:'employ', label:'Zaposlenje' },
    { key:'finance', label:'Finansije' }, { key:'absence', label:'Odsustva' }, { key:'history', label:'Historija' },
  ]

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/hr/staff')}>← Zaposleni</button>
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
            {staff.contract_type && <span className={styles.contractBadge}>{CONTRACT_TYPES[staff.contract_type]}</span>}
          </div>
        </div>
        <div className={styles.profileStats}>
          {yearsWorked && (
            <div className={styles.statItem}>
              <div className={styles.statVal}>{yearsWorked}</div>
              <div className={styles.statLabel}>god. rada</div>
            </div>
          )}
          {staff.wage_amount > 0 && (
            <div className={styles.statItem}>
              <div className={styles.statVal}>€{parseFloat(staff.wage_amount).toFixed(0)}</div>
              <div className={styles.statLabel}>{staff.wage_type==='hourly'?'po satu':staff.wage_type==='weekly'?'sedmično':'mjesečno'}</div>
            </div>
          )}
          <div className={styles.statItem}>
            <div className={styles.statVal}>{vacationLeft}</div>
            <div className={styles.statLabel}>dana odmora</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statVal} style={{color: staff.user_id ? '#0d7a52' : '#BA7517'}}>
              {staff.user_id ? '✓' : '⏳'}
            </div>
            <div className={styles.statLabel}>{staff.user_id ? 'Aktivan' : 'Čeka'}</div>
          </div>
        </div>
      </div>

      {/* Tabovi */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.key} className={`${styles.tab} ${activeTab===t.key?styles.tabActive:''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab sadržaj */}
      <div className={styles.tabBody}>

        {/* OSNOVNE INFO */}
        {activeTab === 'basic' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Lični podaci</div>
            <div className={styles.formGrid}>
              <Field label="Ime"><input value={basicForm.first_name} onChange={e => setBasicForm(f=>({...f,first_name:e.target.value}))} placeholder="Ime" /></Field>
              <Field label="Prezime"><input value={basicForm.last_name} onChange={e => setBasicForm(f=>({...f,last_name:e.target.value}))} placeholder="Prezime" /></Field>
              <Field label="Telefon"><input value={basicForm.phone} onChange={e => setBasicForm(f=>({...f,phone:e.target.value}))} placeholder="+382 67 ..." /></Field>
              <Field label="Datum rođenja"><input type="date" value={basicForm.date_of_birth} onChange={e => setBasicForm(f=>({...f,date_of_birth:e.target.value}))} /></Field>
              <Field label="Adresa" full><input value={basicForm.address} onChange={e => setBasicForm(f=>({...f,address:e.target.value}))} placeholder="Ulica, grad" /></Field>
            </div>
            <div className={styles.divider}>Kontakt za hitne slučajeve</div>
            <div className={styles.formGrid}>
              <Field label="Ime i prezime"><input value={basicForm.emergency_contact_name} onChange={e => setBasicForm(f=>({...f,emergency_contact_name:e.target.value}))} placeholder="npr. Marija Paunović" /></Field>
              <Field label="Telefon"><input value={basicForm.emergency_contact_phone} onChange={e => setBasicForm(f=>({...f,emergency_contact_phone:e.target.value}))} placeholder="+382 ..." /></Field>
            </div>
            <SaveRow onSave={() => saveTab(basicForm)} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* ZAPOSLENJE */}
        {activeTab === 'employ' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Podaci o zaposlenju</div>
            <div className={styles.formGrid}>
              <Field label="Pozicija"><input value={employForm.position} onChange={e => setEmployForm(f=>({...f,position:e.target.value}))} placeholder="npr. Šef kuhinje" /></Field>
              <Field label="Rola">
                <select value={employForm.role_id} onChange={e => setEmployForm(f=>({...f,role_id:e.target.value}))}>
                  <option value="">— Bez role —</option>
                  {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Vrsta ugovora">
                <select value={employForm.contract_type} onChange={e => setEmployForm(f=>({...f,contract_type:e.target.value}))}>
                  {Object.entries(CONTRACT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Radno vrijeme">
                <select value={employForm.employment_type} onChange={e => setEmployForm(f=>({...f,employment_type:e.target.value}))}>
                  {Object.entries(EMPLOYMENT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Datum početka"><input type="date" value={employForm.start_date} onChange={e => setEmployForm(f=>({...f,start_date:e.target.value}))} /></Field>
              <Field label="Datum završetka"><input type="date" value={employForm.end_date} onChange={e => setEmployForm(f=>({...f,end_date:e.target.value}))} /></Field>
              <Field label="Tip plate">
                <select value={employForm.wage_type} onChange={e => setEmployForm(f=>({...f,wage_type:e.target.value}))}>
                  <option value="monthly">Mjesečna</option>
                  <option value="weekly">Sedmična</option>
                  <option value="hourly">Po satu</option>
                </select>
              </Field>
              <Field label="Iznos plate (€)"><input type="number" min="0" step="0.01" value={employForm.wage_amount} onChange={e => setEmployForm(f=>({...f,wage_amount:e.target.value}))} placeholder="0.00" /></Field>
              <Field label="Napomene" full><textarea rows={3} value={employForm.notes} onChange={e => setEmployForm(f=>({...f,notes:e.target.value}))} placeholder="Interne napomene..." /></Field>
            </div>
            <SaveRow onSave={() => saveTab({...employForm, wage_amount: parseFloat(employForm.wage_amount)||0})} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* FINANSIJE */}
        {activeTab === 'finance' && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Finansijski podaci</div>
            <div className={styles.formGrid}>
              <Field label="Broj bankovnog računa" full><input value={financeForm.bank_account} onChange={e => setFinanceForm(f=>({...f,bank_account:e.target.value}))} placeholder="ME25 ..." /></Field>
              <Field label="Porezni broj / JMBG" full><input value={financeForm.tax_id} onChange={e => setFinanceForm(f=>({...f,tax_id:e.target.value}))} placeholder="Poreski identifikacioni broj" /></Field>
            </div>

            <SaveRow onSave={() => saveTab(financeForm)} saving={saving} saved={saved} error={saveError} />
          </div>
        )}

        {/* ODSUSTVA */}
        {activeTab === 'absence' && (
          <div className={styles.card}>
            <div className={styles.vacationTracker}>
              <div className={styles.vacTrackerTitle}>Godišnji odmor</div>
              <div className={styles.vacTrackerRow}>
                <div className={styles.vacCard}><div className={styles.vacNum}>{financeForm.vacation_days_total}</div><div className={styles.vacLabel}>Ukupno dana</div></div>
                <div className={styles.vacCard}><div className={styles.vacNum} style={{color:'#BA7517'}}>{vacationDaysUsed}</div><div className={styles.vacLabel}>Iskorišteno</div></div>
                <div className={styles.vacCard}><div className={styles.vacNum} style={{color:'#0d7a52'}}>{vacationLeft}</div><div className={styles.vacLabel}>Preostalo</div></div>
                <div className={styles.vacEditField}>
                  <label>Ukupno dana odmora</label>
                  <input type="number" min="0" value={financeForm.vacation_days_total} onChange={e => setFinanceForm(f=>({...f,vacation_days_total:parseInt(e.target.value)||0}))} />
                  <button className={styles.btnSaveSmall} onClick={() => saveTab({vacation_days_total: financeForm.vacation_days_total})}>Sačuvaj</button>
                </div>
              </div>
            </div>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Evidencija odsustva</div>
              <button className={styles.btnPrimary} onClick={() => setShowAbsenceForm(v=>!v)}>+ Dodaj</button>
            </div>
            {showAbsenceForm && (
              <form onSubmit={saveAbsence} className={styles.inlineForm}>
                <div className={styles.formGrid}>
                  <Field label="Tip">
                    <select value={absenceForm.absence_type} onChange={e=>setAbsenceForm(f=>({...f,absence_type:e.target.value}))}>
                      {Object.entries(ABSENCE_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Odobreno">
                    <select value={absenceForm.approved} onChange={e=>setAbsenceForm(f=>({...f,approved:e.target.value==='true'}))}>
                      <option value="true">Da</option><option value="false">Ne</option>
                    </select>
                  </Field>
                  <Field label="Od datuma"><input type="date" required value={absenceForm.start_date} onChange={e=>setAbsenceForm(f=>({...f,start_date:e.target.value}))} /></Field>
                  <Field label="Do datuma"><input type="date" required value={absenceForm.end_date} onChange={e=>setAbsenceForm(f=>({...f,end_date:e.target.value}))} /></Field>
                  <Field label="Napomena" full><input value={absenceForm.notes} onChange={e=>setAbsenceForm(f=>({...f,notes:e.target.value}))} placeholder="Opcionalno" /></Field>
                </div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowAbsenceForm(false)}>Odustani</button>
                  <button type="submit" className={styles.btnPrimary}>Sačuvaj</button>
                </div>
              </form>
            )}
            {absences.length === 0 ? <div className={styles.empty}>Nema evidentiranih odsustva</div> : (
              <div className={styles.absenceList}>
                {absences.map(a => (
                  <div key={a.id} className={styles.absenceItem}>
                    <span className={styles.absenceTag} style={{background:ABSENCE_TYPES[a.absence_type]?.bg,color:ABSENCE_TYPES[a.absence_type]?.color}}>{ABSENCE_TYPES[a.absence_type]?.label}</span>
                    <div className={styles.absenceDates}>
                      {new Date(a.start_date).toLocaleDateString('sr-Latn')} — {new Date(a.end_date).toLocaleDateString('sr-Latn')}
                      <span className={styles.absenceDays}> · {a.days} {a.days===1?'dan':'dana'}</span>
                    </div>
                    <span className={styles.absenceApproved}>{a.approved ? <span style={{color:'#0d7a52'}}>✓ Odobreno</span> : <span style={{color:'#BA7517'}}>Na čekanju</span>}</span>
                    <button className={styles.delBtn} onClick={() => deleteAbsence(a.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORIJA */}
        {activeTab === 'history' && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Historija zaposlenja</div>
              <button className={styles.btnPrimary} onClick={() => setShowHistoryForm(v=>!v)}>+ Dodaj zapis</button>
            </div>
            {showHistoryForm && (
              <form onSubmit={saveHistoryEvent} className={styles.inlineForm}>
                <div className={styles.formGrid}>
                  <Field label="Tip događaja">
                    <select value={historyForm.event_type} onChange={e=>setHistoryForm(f=>({...f,event_type:e.target.value}))}>
                      <option value="note">📝 Napomena</option>
                      <option value="promoted">⬆️ Unaprijeđen</option>
                      <option value="wage_change">💰 Promjena plate</option>
                      <option value="position_change">🔄 Promjena pozicije</option>
                      <option value="warning">⚠️ Upozorenje</option>
                      <option value="terminated">🔚 Prestanak rada</option>
                    </select>
                  </Field>
                  <Field label="Datum"><input type="date" value={historyForm.event_date} onChange={e=>setHistoryForm(f=>({...f,event_date:e.target.value}))} /></Field>
                  <Field label="Opis *" full><input required value={historyForm.description} onChange={e=>setHistoryForm(f=>({...f,description:e.target.value}))} placeholder="Kratak opis..." /></Field>
                </div>
                <div className={styles.saveRow}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setShowHistoryForm(false)}>Odustani</button>
                  <button type="submit" className={styles.btnPrimary}>Sačuvaj</button>
                </div>
              </form>
            )}
            {history.length === 0 ? <div className={styles.empty}>Nema historije zaposlenja</div> : (
              <div className={styles.timeline}>
                {history.map(h => (
                  <div key={h.id} className={styles.tlItem}>
                    <div className={styles.tlDot}>{HISTORY_ICONS[h.event_type]||'📝'}</div>
                    <div className={styles.tlContent}>
                      <div className={styles.tlDesc}>{h.description}</div>
                      <div className={styles.tlDate}>{new Date(h.event_date).toLocaleDateString('sr-Latn', {day:'numeric', month:'long', year:'numeric'})}</div>
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
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:12, marginTop:16, paddingTop:12, borderTop:'1px solid #f0f5f2' }}>
      {error && <span style={{ color:'#c0392b', fontSize:12 }}>Greška: {error}</span>}
      <button
        style={{ padding:'10px 20px', background: saving ? '#888' : '#0d7a52', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'DM Sans, sans-serif' }}
        onClick={onSave} disabled={saving}
      >
        {saving ? 'Čuvanje...' : saved ? '✓ Sačuvano' : 'Sačuvaj promjene'}
      </button>
    </div>
  )
}
