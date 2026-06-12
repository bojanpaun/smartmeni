import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

export default function GeneralSettings() {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setIsDirty(false)
      setForm({
        name:        restaurant.name        || '',
        location:    restaurant.location    || '',
        phone:       restaurant.phone       || '',
        hours:       restaurant.hours       || '',
        description: restaurant.description || '',
      })
    }
  }, [restaurant])

  const save = async (e) => {
    e.preventDefault()
    if (!restaurant || !form) return
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...form })
    setSaving(false)
    setSaved(true)
    setIsDirty(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const setField = (field, val) => { setForm(f => ({ ...f, [field]: val })); setIsDirty(true) }

  if (!form) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('gsTitle')}</h1>
        <p className={styles.subtitle}>{t('gsSubtitle')}</p>
      </div>

      <form onSubmit={save} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>{t('amRestaurantName')}</label>
            <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder={t('gsPhName')} />
          </div>
          <div className={styles.field}>
            <label>{t('amLocation')}</label>
            <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder={t('gsPhLocation')} />
          </div>
          <div className={styles.field}>
            <label>{t('amPhone')}</label>
            <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder={t('gsPhPhone')} />
          </div>
          <div className={styles.field}>
            <label>{t('amHours')}</label>
            <input value={form.hours} onChange={e => setField('hours', e.target.value)} placeholder={t('gsPhHours')} />
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 20 }}>
          <label>{t('msDescLabel')}</label>
          <textarea
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            placeholder={t('msDescPlaceholder')}
            rows={3}
            className={styles.textarea}
          />
          <div className={styles.fieldHint}>{t('msDescHint')}</div>
        </div>
        <div className={styles.formActions}>
          {saved && !isDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
          {(isDirty || saving) && (
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? t('saving') : t('amSaveChanges')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
