import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useSpaTherapists } from '../hooks/useSpaTherapists'
import { useSpaServices } from '../hooks/useSpaServices'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const BLANK = {
  staff_id: '', bio: '', specializations: '', languages: 'bs', is_available: true,
}

export default function TherapistsPage() {
  const { restaurant } = usePlatform()
  const { therapists, staff, loading, save, remove, toggleAvailable } = useSpaTherapists(restaurant?.id)
  const { services } = useSpaServices(restaurant?.id)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [selectedServices, setSelectedServices] = useState([])
  const [saving, setSaving]     = useState(false)

  if (!restaurant) return <LoadingSpinner fullPage />

  const openNew = () => {
    setEditing(null); setForm(BLANK); setSelectedServices([]); setShowForm(true)
  }
  const openEdit = (t) => {
    setEditing(t.id)
    setForm({
      staff_id: t.staff_id,
      bio: t.bio || '',
      specializations: (t.specializations || []).join(', '),
      languages: (t.languages || ['bs']).join(', '),
      is_available: t.is_available,
    })
    setSelectedServices(t.spa_therapist_services?.map(ts => ts.service_id) || [])
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleService = (id) => setSelectedServices(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  )

  const handleSave = async () => {
    if (!form.staff_id) return
    setSaving(true)
    const values = {
      ...form,
      specializations: form.specializations.split(',').map(s => s.trim()).filter(Boolean),
      languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
    }
    await save(values, selectedServices, editing)
    setSaving(false)
    close()
  }

  // Staff koji još nisu terapeuti (za dropdown u formi)
  const availableStaff = staff.filter(s =>
    !therapists.some(t => t.staff_id === s.id) || (editing && therapists.find(t => t.id === editing)?.staff_id === s.id)
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Terapeuti</h1>
          <p className={styles.subtitle}>Profili terapeuta i tretmani koje mogu raditi</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Dodaj terapeuta</button>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? 'Uredi terapeuta' : 'Novi terapeut'}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Osoblje *</label>
              <select className={spa.formSelect} value={form.staff_id} onChange={e => upd('staff_id', e.target.value)}>
                <option value="">— Odaberite osobu —</option>
                {availableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Jezici (zarezom razdvojeni)</label>
              <input className={spa.formInput} value={form.languages} onChange={e => upd('languages', e.target.value)} placeholder="bs, en, de" />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Specijalizacije (zarezom razdvojene)</label>
              <input className={spa.formInput} value={form.specializations} onChange={e => upd('specializations', e.target.value)} placeholder="deep_tissue, hot_stone, facial" />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Bio (opciono)</label>
              <textarea className={spa.formTextarea} value={form.bio} onChange={e => upd('bio', e.target.value)} placeholder="Kratki opis iskustva terapeuta..." rows={3} />
            </div>

            {/* Tretmani koje terapeut može raditi */}
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Tretmani koje može raditi</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {services.filter(s => s.is_active).map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <label className={spa.toggle}>
                <input type="checkbox" checked={form.is_available} onChange={e => upd('is_available', e.target.checked)} />
                <span className={spa.toggleSlider} />
              </label>
              <span className={spa.formLabel} style={{ margin: 0 }}>Dostupan za booking</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Čuvanje...' : editing ? 'Sačuvaj izmjene' : 'Dodaj terapeuta'}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : therapists.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>👤</div>
          <p>Nema terapeuta. Dodajte prvog terapeuta iz reda osoblja.</p>
        </div>
      ) : (
        <table className={spa.table} style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr>
              <th>Terapeut</th>
              <th>Specijalizacije</th>
              <th>Tretmani</th>
              <th>Jezici</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {therapists.map(t => {
              const staffInfo = t.staff
              const name = staffInfo ? `${staffInfo.first_name} ${staffInfo.last_name}` : '—'
              const treatments = t.spa_therapist_services?.map(ts => ts.spa_services?.name).filter(Boolean) || []
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{name}</div>
                    {staffInfo?.role && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{staffInfo.role}</div>}
                  </td>
                  <td>
                    <div className={spa.chipWrap}>
                      {(t.specializations || []).map((s, i) => <span key={i} className={spa.chip}>{s}</span>)}
                      {(t.specializations || []).length === 0 && <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>—</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                      {treatments.length > 0 ? treatments.slice(0, 3).join(', ') + (treatments.length > 3 ? ` +${treatments.length - 3}` : '') : '—'}
                    </div>
                  </td>
                  <td>
                    <div className={spa.chipWrap}>
                      {(t.languages || []).map((l, i) => <span key={i} className={spa.chip}>{l.toUpperCase()}</span>)}
                    </div>
                  </td>
                  <td>
                    <label className={spa.toggle}>
                      <input type="checkbox" checked={t.is_available} onChange={e => toggleAvailable(t.id, e.target.checked)} />
                      <span className={spa.toggleSlider} />
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(t)}>Uredi</button>
                      <button
                        style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer' }}
                        onClick={() => { if (window.confirm('Obrisati terapeuta?')) remove(t.id) }}
                      >Obriši</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
