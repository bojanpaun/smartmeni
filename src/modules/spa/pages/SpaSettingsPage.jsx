import { useState, useEffect } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const DAYS = [
  { dow: 1, label: 'Pon' }, { dow: 2, label: 'Uto' }, { dow: 3, label: 'Sri' },
  { dow: 4, label: 'Čet' }, { dow: 5, label: 'Pet' }, { dow: 6, label: 'Sub' },
  { dow: 0, label: 'Ned' },
]

const DEFAULT_SETTINGS = {
  open_time: '09:00', close_time: '20:00',
  working_days: [1, 2, 3, 4, 5, 6],
  min_advance_hours: 2, cancellation_hours: 24, reminder_hours: 2,
}

export default function SpaSettingsPage() {
  const { restaurant } = usePlatform()
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
    if (error) toast.error('Greška pri čuvanju')
    else toast.success('Postavke sačuvane')
  }

  if (!restaurant || loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Spa postavke</h1>
          <p className={styles.subtitle}>Radno vrijeme, politika otkazivanja i obavještenja</p>
        </div>
        <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Čuvanje...' : 'Sačuvaj postavke'}
        </button>
      </div>

      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Radno vrijeme */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>⏰ Radno vrijeme</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Otvaranje</label>
              <input className={spa.formInput} type="time" value={settings.open_time} onChange={e => upd('open_time', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Zatvaranje</label>
              <input className={spa.formInput} type="time" value={settings.close_time} onChange={e => upd('close_time', e.target.value)} />
            </div>
          </div>
          <div className={spa.formField}>
            <label className={spa.formLabel}>Radni dani</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {DAYS.map(({ dow, label }) => {
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
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Booking politika */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>📋 Politika bookinga</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Min. rezervacija unaprijed (sati)</label>
              <input className={spa.formInput} type="number" min="0" max="168" value={settings.min_advance_hours} onChange={e => upd('min_advance_hours', Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Gost mora rezervisati min. X sati unaprijed</span>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Besplatno otkazivanje do (sati)</label>
              <input className={spa.formInput} type="number" min="0" max="168" value={settings.cancellation_hours} onChange={e => upd('cancellation_hours', Number(e.target.value))} />
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Otkazivanje besplatno X sati prije termina</span>
            </div>
          </div>
        </div>

        {/* Email podsjetnik */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>🔔 Email podsjetnik</h2>
          <div className={spa.formField} style={{ maxWidth: 280 }}>
            <label className={spa.formLabel}>Pošalji podsjetnik X sati prije termina</label>
            <input className={spa.formInput} type="number" min="1" max="72" value={settings.reminder_hours} onChange={e => upd('reminder_hours', Number(e.target.value))} />
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Automatski email podsjetnik se šalje gostima</span>
          </div>
        </div>

      </div>
    </div>
  )
}
