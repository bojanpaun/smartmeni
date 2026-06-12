import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useSpaRooms } from '../hooks/useSpaRooms'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const ROOM_TYPES = [
  { value: 'treatment_room', key: 'spaRoomTypeTreatment', icon: '💆' },
  { value: 'wet_facility',   key: 'spaRoomTypeWet',       icon: '🚿' },
  { value: 'fitness',        key: 'spaRoomTypeFitness',   icon: '🏋️' },
  { value: 'group',          key: 'spaRoomTypeGroup',     icon: '👥' },
  { value: 'relaxation',     key: 'spaRoomTypeRelax',     icon: '🛋️' },
]

const BLANK = {
  name: '', type: 'treatment_room', capacity: 1,
  description: '', amenities: '', is_active: true, display_order: 0,
}

export default function SpaRoomsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const { rooms, loading, save, remove } = useSpaRooms(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)

  if (!restaurant) return <LoadingSpinner fullPage />

  const openNew  = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (r) => {
    setEditing(r.id)
    setForm({ ...BLANK, ...r, amenities: (r.amenities || []).join(', ') })
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      amenities: form.amenities.split(',').map(s => s.trim()).filter(Boolean),
    }
    await save(payload, editing)
    setSaving(false)
    close()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaRoomsTitle')}</h1>
          <p className={styles.subtitle}>{t('spaRoomsSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ {t('spaNewRoom')}</button>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? t('spaEditRoom') : t('spaNewRoom')}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaRoomName')}</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} placeholder={t('spaRoomNamePh')} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaRoomType')}</label>
              <select className={spa.formSelect} value={form.type} onChange={e => upd('type', e.target.value)}>
                {ROOM_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.icon} {t(rt.key)}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaRoomCapacity')}</label>
              <input className={spa.formInput} type="number" min="1" max="50" value={form.capacity} onChange={e => upd('capacity', Number(e.target.value))} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaDisplayOrder')}</label>
              <input className={spa.formInput} type="number" min="0" value={form.display_order} onChange={e => upd('display_order', Number(e.target.value))} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaDescOptional')}</label>
              <textarea className={spa.formTextarea} value={form.description || ''} onChange={e => upd('description', e.target.value)} placeholder={t('spaRoomDescPh')} rows={2} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaAmenitiesLabel')}</label>
              <input className={spa.formInput} value={form.amenities} onChange={e => upd('amenities', e.target.value)} placeholder={t('spaAmenitiesPh')} />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <label className={spa.toggle}>
                <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
                <span className={spa.toggleSlider} />
              </label>
              <span className={spa.formLabel} style={{ margin: 0 }}>{t('spaRoomActive')}</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editing ? t('spaSaveChanges') : t('spaCreateRoom')}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : rooms.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>🚪</div>
          <p>{t('spaNoRooms')}</p>
        </div>
      ) : (
        <div className={spa.cardGrid}>
          {rooms.map(r => {
            const typeInfo = ROOM_TYPES.find(rt => rt.value === r.type) || ROOM_TYPES[0]
            const amenities = Array.isArray(r.amenities) ? r.amenities : []
            return (
              <div key={r.id} className={spa.card} style={{ opacity: r.is_active ? 1 : 0.65 }}>
                <div className={spa.cardImgPlaceholder} style={{ height: 100 }}>{typeInfo.icon}</div>
                <div className={spa.cardBody}>
                  <div className={spa.cardTitle}>{r.name}</div>
                  <div className={spa.cardMeta}>
                    <span>{t(typeInfo.key)}</span>
                    <span>👥 {t('spaMax')} {r.capacity}</span>
                    <span className={`${spa.badge} ${r.is_active ? spa.badgeActive : spa.badgeInactive}`}>
                      {r.is_active ? t('spaActiveF') : t('spaInactiveF')}
                    </span>
                  </div>
                  {amenities.length > 0 && (
                    <div className={spa.chipWrap}>
                      {amenities.slice(0, 4).map((a, i) => <span key={i} className={spa.chip}>{a}</span>)}
                      {amenities.length > 4 && <span className={spa.chip}>+{amenities.length - 4}</span>}
                    </div>
                  )}
                  <div className={spa.cardActions} style={{ marginTop: 12 }}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(r)}>{t('htEdit')}</button>
                    <button
                      style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => { if (window.confirm(t('spaDeleteRoomConfirm'))) remove(r.id) }}
                    >{t('htDelete')}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
