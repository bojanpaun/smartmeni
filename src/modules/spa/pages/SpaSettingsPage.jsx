import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const DAYS = [
  { dow: 1, key: 'spaDayMon' }, { dow: 2, key: 'spaDayTue' }, { dow: 3, key: 'spaDayWed' },
  { dow: 4, key: 'spaDayThu' }, { dow: 5, key: 'spaDayFri' }, { dow: 6, key: 'spaDaySat' },
  { dow: 0, key: 'spaDaySun' },
]

const DEFAULT_SETTINGS = {
  open_time: '09:00', close_time: '20:00',
  working_days: [1, 2, 3, 4, 5, 6],
  min_advance_hours: 2, cancellation_hours: 24, reminder_hours: 2,
}

export default function SpaSettingsPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsId, setSettingsId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!restaurant) return
    supabase.from('spa_settings')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id)
          setSettings({
            open_time:          data.open_time?.slice(0, 5) || '09:00',
            close_time:         data.close_time?.slice(0, 5) || '20:00',
            working_days:       data.working_days || [1,2,3,4,5,6],
            min_advance_hours:  data.min_advance_hours ?? 2,
            cancellation_hours: data.cancellation_hours ?? 24,
            reminder_hours:     data.reminder_hours ?? 2,
          })
        }
        setLoading(false)
      })
  }, [restaurant])

  const toggleDay = (dow) => setSettings(s => ({
    ...s,
    working_days: s.working_days.includes(dow)
      ? s.working_days.filter(d => d !== dow)
      : [...s.working_days, dow].sort((a, b) => a - b),
  }))

  const upd = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const handleSave = async () => {
    if (!restaurant) return
    setSaving(true)
    const payload = { ...settings, restaurant_id: restaurant.id }
    const { error } = settingsId
      ? await supabase.from('spa_settings').update(payload).eq('id', settingsId)
      : await supabase.from('spa_settings').insert(payload).select('id').single()
        .then(({ data, error }) => {
          if (data) setSettingsId(data.id)
          return { error }
        })
    setSaving(false)
    if (error) toast.error(t('spaSetSaveErr'))
    else toast.success(t('spaSetSaved'))
  }

  if (!restaurant || loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaSetTitle')}</h1>
          <p className={styles.subtitle}>{t('spaSetSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('spaSetSave')}
        </button>
      </div>

      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Radno vrijeme */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>⏰ {t('spaSetWorkHours')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaSetOpen')}</label>
              <input className={spa.formInput} type="time" value={settings.open_time} onChange={e => upd('open_time', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaSetClose')}</label>
              <input className={spa.formInput} type="time" value={settings.close_time} onChange={e => upd('close_time', e.target.value)} />
            </div>
          </div>
          <div className={spa.formField}>
            <label className={spa.formLabel}>{t('spaSetWorkDays')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {DAYS.map(({ dow, key }) => {
                const active = settings.working_days.includes(dow)
                return (
                  <button
                    key={dow}
                    onClick={() => toggleDay(dow)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      border: '1px solid', cursor: 'pointer',
                      background: active ? 'var(--c-primary)' : 'var(--c-surface)',
                      color: active ? '#fff' : 'var(--c-text-muted)',
                      borderColor: active ? 'var(--c-primary)' : 'var(--c-border)',
                    }}
                  >
                    {t(key)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Booking politika */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>📋 {t('spaSetBookingPolicy')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaSetMinAdvance')}</label>
              <input className={spa.formInput} type="number" min="0" max="168" value={settings.min_advance_hours} onChange={e => upd('min_advance_hours', Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{t('spaSetMinAdvanceHint')}</span>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaSetFreeCancel')}</label>
              <input className={spa.formInput} type="number" min="0" max="168" value={settings.cancellation_hours} onChange={e => upd('cancellation_hours', Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{t('spaSetFreeCancelHint')}</span>
            </div>
          </div>
        </div>

        {/* Email podsjetnik */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>🔔 {t('spaSetEmailReminder')}</h2>
          <div className={spa.formField} style={{ maxWidth: 280 }}>
            <label className={spa.formLabel}>{t('spaSetReminderLabel')}</label>
            <input className={spa.formInput} type="number" min="1" max="72" value={settings.reminder_hours} onChange={e => upd('reminder_hours', Number(e.target.value))} />
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{t('spaSetReminderHint')}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
