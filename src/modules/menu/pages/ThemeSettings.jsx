import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './ThemeSettings.module.css'

// Tenant bira paletu admin panela. Ponuda = ugrađene palete (zelena/plava/ljubičasta,
// uz eventualne superadmin override-e) + custom palete koje je superadmin kreirao
// (theme_palettes). Izbor se snima u restaurants.admin_theme → mirror na tenants →
// useTheme (preko PlatformContext.restaurant) primjenjuje paletu na /admin rutama.
// Dark/light je zaseban per-user toggle (sunce/mjesec u topbaru) i radi sa svakom paletom.

const BUILTIN_KEYS = ['green', 'blue', 'purple']

// Light preview boje ugrađenih paleta (izvor: index.css :root i [data-theme="..."]).
const BUILTIN_THEMES = [
  { key: 'green',  name: 'Zelena',     light: { primary: '#0d7a52', primaryLight: '#e0f5ec', sbBg: '#0d2b1e', sbAccent: '#5dcaa5' } },
  { key: 'blue',   name: 'Plava',      light: { primary: '#2563eb', primaryLight: '#eff6ff', sbBg: '#0c1938', sbAccent: '#60a5fa' } },
  { key: 'purple', name: 'Ljubičasta', light: { primary: '#7c3aed', primaryLight: '#f3effe', sbBg: '#1e1340', sbAccent: '#a78bfa' } },
]

export default function ThemeSettings() {
  const { restaurant, setRestaurant, palettes } = usePlatform()
  const [selected, setSelected] = useState('green')
  const [savedTheme, setSavedTheme] = useState('green')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (restaurant?.admin_theme) {
      setSelected(restaurant.admin_theme)
      setSavedTheme(restaurant.admin_theme)
    }
  }, [restaurant?.admin_theme])

  // Ugrađene (uz override iz theme_palettes ako postoji) + custom palete.
  const themes = [
    ...BUILTIN_THEMES.map(b => {
      const ov = (palettes ?? []).find(p => p.key === b.key)
      return ov ? { ...b, light: { ...b.light, ...(ov.light || {}) } } : b
    }),
    ...(palettes ?? [])
      .filter(p => !BUILTIN_KEYS.includes(p.key))
      .map(p => ({ key: p.key, name: p.name, light: p.light || {} })),
  ]

  const isDirty = selected !== savedTheme

  const save = async () => {
    if (!restaurant || !isDirty) return
    setSaving(true)
    const { error } = await supabase.from('restaurants').update({ admin_theme: selected }).eq('id', restaurant.id)
    setSaving(false)
    if (error) return
    // setRestaurant → useTheme reaguje na admin_theme i primjenjuje paletu odmah.
    setRestaurant({ ...restaurant, admin_theme: selected })
    setSavedTheme(selected)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Izgled / Tema</h1>
        <p className={styles.subtitle}>
          Izaberi paletu boja admin panela. Tema se primjenjuje odmah nakon čuvanja.
          Svijetli/tamni način mijenjaš dugmetom ☀️/🌙 u gornjoj traci — radi sa svakom paletom.
        </p>
      </div>

      <div className={styles.grid}>
        {themes.map(t => {
          const active = selected === t.key
          const light = t.light || {}
          return (
            <button
              key={t.key}
              type="button"
              className={`${styles.card} ${active ? styles.cardActive : ''}`}
              onClick={() => setSelected(t.key)}
            >
              {active && <span className={styles.check}>✓</span>}
              <div className={styles.preview}>
                <div className={styles.previewSb} style={{ background: light.sbBg || '#0d2b1e' }}>
                  <span className={styles.previewDot} style={{ background: light.sbAccent || '#5dcaa5' }} />
                  <span className={styles.previewDot} style={{ background: light.sbAccent || '#5dcaa5', opacity: 0.5 }} />
                  <span className={styles.previewDot} style={{ background: light.sbAccent || '#5dcaa5', opacity: 0.3 }} />
                </div>
                <div className={styles.previewBody}>
                  <span className={styles.previewBtn} style={{ background: light.primary || '#0d7a52' }} />
                  <span className={styles.previewBadge} style={{ background: light.primaryLight || '#e0f5ec', color: light.primary || '#0d7a52' }}>badge</span>
                  <span className={styles.previewLine} />
                  <span className={styles.previewLineShort} />
                </div>
              </div>
              <div className={styles.cardName}>{t.name}</div>
            </button>
          )
        })}
      </div>

      <div className={styles.actions}>
        {saved && !isDirty && <span className={styles.savedMsg}>✓ Sačuvano</span>}
        {isDirty && (
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? 'Čuvanje…' : 'Sačuvaj temu'}
          </button>
        )}
      </div>
    </div>
  )
}
