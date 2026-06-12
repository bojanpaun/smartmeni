import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { deriveShades } from '../../../lib/brandPalette'
import { READY_LANGUAGES, DEFAULT_LANG } from '../../../i18n/languages'
import styles from './ThemeSettings.module.css'

// Tenant bira paletu admin panela. Ponuda = ugrađene palete (zelena/plava/ljubičasta,
// uz eventualne superadmin override-e) + custom palete koje je superadmin kreirao
// (theme_palettes). Izbor se snima u restaurants.admin_theme → mirror na tenants →
// useTheme (preko PlatformContext.restaurant) primjenjuje paletu na /admin rutama.
// Dark/light je zaseban per-user toggle (sunce/mjesec u topbaru) i radi sa svakom paletom.

const BUILTIN_KEYS = ['green', 'blue', 'purple']

// Light preview boje ugrađenih paleta (izvor: index.css :root i [data-theme="..."]).
const BUILTIN_THEMES = [
  { key: 'green',  nameKey: 'thGreen',  light: { primary: '#0d7a52', primaryLight: '#e0f5ec', sbBg: '#0d2b1e', sbAccent: '#5dcaa5' } },
  { key: 'blue',   nameKey: 'thBlue',   light: { primary: '#2563eb', primaryLight: '#eff6ff', sbBg: '#0c1938', sbAccent: '#60a5fa' } },
  { key: 'purple', nameKey: 'thPurple', light: { primary: '#7c3aed', primaryLight: '#f3effe', sbBg: '#1e1340', sbAccent: '#a78bfa' } },
]

export default function ThemeSettings() {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant, palettes } = usePlatform()
  const [selected, setSelected] = useState('green')
  const [savedTheme, setSavedTheme] = useState('green')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Admin jezik (per-tenant default). Sibling admin_theme; mirror na tenants. Vozi
  // AdminLangSync (App.jsx) na /admin rutama. Switcher u topbaru je per-sesija override.
  const [lang, setLang] = useState(DEFAULT_LANG)
  const [savedLang, setSavedLang] = useState(DEFAULT_LANG)
  const [langSaving, setLangSaving] = useState(false)
  const [langSaved, setLangSaved] = useState(false)

  useEffect(() => {
    if (restaurant?.admin_theme) {
      setSelected(restaurant.admin_theme)
      setSavedTheme(restaurant.admin_theme)
    }
  }, [restaurant?.admin_theme])

  useEffect(() => {
    const al = restaurant?.admin_language || DEFAULT_LANG
    setLang(al)
    setSavedLang(al)
  }, [restaurant?.admin_language])

  const langDirty = lang !== savedLang
  const saveLang = async () => {
    if (!restaurant || !langDirty) return
    setLangSaving(true)
    const { error } = await supabase.from('restaurants').update({ admin_language: lang }).eq('id', restaurant.id)
    setLangSaving(false)
    if (error) return
    // Očisti per-sesija override da novi tenant default odmah zaživi; setRestaurant
    // → AdminLangSync primijeni novi admin_language.
    try { sessionStorage.removeItem('sm_admin_lang') } catch { /* ignore */ }
    setRestaurant({ ...restaurant, admin_language: lang })
    setSavedLang(lang)
    setLangSaved(true)
    setTimeout(() => setLangSaved(false), 3000)
  }

  // Brend paleta (izvedena iz boje objekta) + ugrađene (uz override) + custom palete.
  const brandTheme = { key: 'brand', nameKey: 'navBrand', light: deriveShades(restaurant?.color || '#0d7a52').light }
  const themes = [
    brandTheme,
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
        <h1 className={styles.title}>{t('navTheme')}</h1>
        <p className={styles.subtitle}>
          {t('thSubtitle')}
        </p>
      </div>

      <div className={styles.grid}>
        {themes.map(th => {
          const active = selected === th.key
          const light = th.light || {}
          return (
            <button
              key={th.key}
              type="button"
              className={`${styles.card} ${active ? styles.cardActive : ''}`}
              onClick={() => setSelected(th.key)}
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
              <div className={styles.cardName}>{th.nameKey ? t(th.nameKey) : th.name}</div>
            </button>
          )
        })}
      </div>

      <div className={styles.actions}>
        {saved && !isDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
        {isDirty && (
          <button className={styles.saveBtn} onClick={save} disabled={saving}>
            {saving ? t('saving') : t('thSaveTheme')}
          </button>
        )}
      </div>

      {/* ── Jezik admin panela (per-tenant default) ── */}
      <div className={styles.header} style={{ marginTop: 40 }}>
        <h1 className={styles.title}>{t('thLangTitle')}</h1>
        <p className={styles.subtitle}>
          {t('thLangSubtitle')}
        </p>
      </div>
      <div className={styles.actions} style={{ justifyContent: 'flex-start', gap: 12 }}>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--c-border)',
            background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {READY_LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
        {langSaved && !langDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
        {langDirty && (
          <button className={styles.saveBtn} onClick={saveLang} disabled={langSaving}>
            {langSaving ? t('saving') : t('thSaveLang')}
          </button>
        )}
      </div>
    </div>
  )
}
