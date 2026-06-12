import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const STATUS_OPTIONS = [
  { value: 'available',   labelKey: 'htStAvailable' },
  { value: 'occupied',    labelKey: 'htStOccupied' },
  { value: 'cleaning',    labelKey: 'htStCleaning' },
  { value: 'maintenance', labelKey: 'htStMaintenance' },
  { value: 'blocked',     labelKey: 'htStBlocked' },
]

const EMPTY = {
  room_number: '',
  room_type_id: '',
  floor: '',
  status: 'available',
  notes: '',
}

export default function RoomFormPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY)
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!restaurant?.id) return

      const { data: types } = await supabase
        .from('room_types')
        .select('id, name')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('sort_order')
      setRoomTypes(types ?? [])

      if (isEdit) {
        const { data: room, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .eq('restaurant_id', restaurant.id)
          .single()
        if (error || !room) {
          toast.error(t('htRoomNotFound'))
          navigate('/admin/hotel/rooms')
          return
        }
        setForm({
          room_number: room.room_number ?? '',
          room_type_id: room.room_type_id ?? '',
          floor: room.floor ?? '',
          status: room.status ?? 'available',
          notes: room.notes ?? '',
        })
        setLoading(false)
      }
    }
    load()
  }, [restaurant?.id, id, isEdit, navigate])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.room_number.trim()) return toast.error(t('htRoomNumberRequired'))

    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      room_number: form.room_number.trim(),
      room_type_id: form.room_type_id || null,
      floor: form.floor !== '' ? Number(form.floor) : null,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('rooms').update(payload).eq('id', id))
    } else {
      ;({ error } = await supabase.from('rooms').insert(payload))
    }

    setSaving(false)
    if (error) {
      if (error.code === '23505') return toast.error(t('htRoomNumberExists'))
      return toast.error(t('htSaveErr') + ': ' + error.message)
    }
    toast.success(isEdit ? t('htRoomUpdated') : t('htRoomAdded'))
    navigate('/admin/hotel/rooms')
  }

  const handleDelete = async () => {
    if (!window.confirm(t('htRoomDeleteConfirm'))) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) return toast.error(t('htDeleteErr') + ': ' + error.message)
    toast.success(t('htRoomDeleted'))
    navigate('/admin/hotel/rooms')
  }

  if (loading) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? t('htEditRoom') : t('htNewRoom')}</h1>
          <p className={styles.subtitle}>
            {isEdit ? t('htRoomNum', { num: form.room_number }) : t('htAddRoomUnitSub')}
          </p>
        </div>
        <button className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/rooms')}>
          ← {t('htBack')}
        </button>
      </div>

      <form className={styles.formSections} onSubmit={handleSubmit}>
        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htRoomData')}</h3>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>{t('htFieldRoomNumber')} *
              <input
                className={styles.input}
                type="text"
                placeholder="npr. 101"
                value={form.room_number}
                onChange={e => set('room_number', e.target.value)}
                required
              />
            </label>

            <label className={styles.formLabel}>{t('htFieldRoomType')}
              <select
                className={styles.input}
                value={form.room_type_id}
                onChange={e => set('room_type_id', e.target.value)}
              >
                <option value="">{t('htSelectType')}</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
              {roomTypes.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>
                  {t('htNoActiveTypes')} <a href="/admin/hotel/room-types" style={{ color: 'var(--c-primary)' }}>{t('htAddTypeLink')}</a>
                </span>
              )}
            </label>

            <label className={styles.formLabel}>{t('htFieldFloor')}
              <input
                className={styles.input}
                type="number"
                placeholder="npr. 1"
                min="0"
                value={form.floor}
                onChange={e => set('floor', e.target.value)}
              />
            </label>

            <label className={styles.formLabel}>{t('htFieldStatus')}
              <select
                className={styles.input}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>{t('htNotes')}</h3>
          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
            <label className={styles.formLabel}>{t('htInternalNotes')}
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                rows={3}
                placeholder="Napomene o sobi vidljive samo osoblju..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </label>
          </div>
        </section>

        <div className={styles.formActions}>
          {isEdit && (
            <button type="button" className={styles.btnDanger} onClick={handleDelete}>
              {t('htDeleteRoom')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/rooms')}>
            {t('cancel')}
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? t('saving') : isEdit ? t('htSaveChanges') : t('htAddRoom')}
          </button>
        </div>
      </form>
    </div>
  )
}
