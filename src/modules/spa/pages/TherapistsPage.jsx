import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('admin')
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
  const openEdit = (tp) => {
    setEditing(tp.id)
    setForm({
      staff_id: tp.staff_id,
      bio: tp.bio || '',
      specializations: (tp.specializations || []).join(', '),
      languages: (tp.languages || ['bs']).join(', '),
      is_available: tp.is_available,
    })
    setSelectedServices(tp.spa_therapist_services?.map(ts => ts.service_id) || [])
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
    !therapists.some(tp => tp.staff_id === s.id) || (editing && therapists.find(tp => tp.id === editing)?.staff_id === s.id)
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaTherapistsTitle')}</h1>
          <p className={styles.subtitle}>{t('spaTherapistsSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ {t('spaAddTherapist')}</button>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? t('spaEditTherapist') : t('spaNewTherapist')}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaStaffLabel')}</label>
              <select className={spa.formSelect} value={form.staff_id} onChange={e => upd('staff_id', e.target.value)}>
                <option value="">{t('spaSelectPerson')}</option>
                {availableStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.role?.name ? ` (${s.role.name})` : ''}</option>
                ))}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaLanguages')}</label>
              <input className={spa.formInput} value={form.languages} onChange={e => upd('languages', e.target.value)} placeholder="bs, en, de" />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaSpecializations')}</label>
              <input className={spa.formInput} value={form.specializations} onChange={e => upd('specializations', e.target.value)} placeholder="deep_tissue, hot_stone, facial" />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaBioOptional')}</label>
              <textarea className={spa.formTextarea} value={form.bio} onChange={e => upd('bio', e.target.value)} placeholder={t('spaBioPh')} rows={3} />
            </div>

            {/* Tretmani koje terapeut može raditi */}
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaTreatmentsCanDo')}</label>
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
              <span className={spa.formLabel} style={{ margin: 0 }}>{t('spaAvailForBooking')}</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editing ? t('spaSaveChanges') : t('spaAddTherapist')}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : therapists.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>👤</div>
          <p>{t('spaNoTherapists')}</p>
        </div>
      ) : (
        <div className={spa.tableScroll}>
        <table className={spa.table} style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr>
              <th>{t('spaTherapist')}</th>
              <th>{t('spaColSpec')}</th>
              <th>{t('spaColTreatments')}</th>
              <th>{t('spaColLangs')}</th>
              <th>{t('spaStatus')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {therapists.map(tp => {
              const staffInfo = tp.staff
              const name = staffInfo ? `${staffInfo.first_name} ${staffInfo.last_name}` : '—'
              const treatments = tp.spa_therapist_services?.map(ts => ts.spa_services?.name).filter(Boolean) || []
              return (
                <tr key={tp.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div>{name}</div>
                    {staffInfo?.role?.name && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{staffInfo.role.name}</div>}
                    {tp.rating != null
                      ? <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>★ {Number(tp.rating).toFixed(2)}</div>
                      : <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{t('spaNoRating')}</div>}
                  </td>
                  <td>
                    <div className={spa.chipWrap}>
                      {(tp.specializations || []).map((s, i) => <span key={i} className={spa.chip}>{s}</span>)}
                      {(tp.specializations || []).length === 0 && <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>—</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                      {treatments.length > 0 ? treatments.slice(0, 3).join(', ') + (treatments.length > 3 ? ` +${treatments.length - 3}` : '') : '—'}
                    </div>
                  </td>
                  <td>
                    <div className={spa.chipWrap}>
                      {(tp.languages || []).map((l, i) => <span key={i} className={spa.chip}>{l.toUpperCase()}</span>)}
                    </div>
                  </td>
                  <td>
                    <label className={spa.toggle}>
                      <input type="checkbox" checked={tp.is_available} onChange={e => toggleAvailable(tp.id, e.target.checked)} />
                      <span className={spa.toggleSlider} />
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(tp)}>{t('htEdit')}</button>
                      <button
                        style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer' }}
                        onClick={() => { if (window.confirm(t('spaDeleteTherapistConfirm'))) remove(tp.id) }}
                      >{t('htDelete')}</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
