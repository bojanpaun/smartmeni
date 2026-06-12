import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { deriveShades } from '../../../lib/brandPalette'
import { getTemplate } from '../../../lib/templates'
import LogoUpload from './LogoUpload'
import styles from './BrandSettings.module.css'

// Kanonski izvor brend identiteta tenanta: LOGO + BOJA BRENDA (restaurants.color).
// Iz boje brenda se OPCIONO (jednosmjerno, „predloži default") izvode:
//   • admin tema  → admin_theme = 'brand' (useTheme je izvodi uživo iz color-a)
//   • meni → predložak 'brand' (boje menija se izvode iz brend boje)
// Sve ostaje nadjačivo u Postavke → Tema, odn. Meni → Predlošci.

export default function BrandSettings() {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant } = usePlatform()
  const [color, setColor] = useState('#0d7a52')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(null) // 'admin' | 'menu'
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (restaurant) setColor(restaurant.color || '#0d7a52')
  }, [restaurant?.color])

  const isDirty = !!restaurant && color !== (restaurant.color || '#0d7a52')
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  const saveColor = async () => {
    if (!restaurant || !isDirty) return
    setSaving(true)
    const { error } = await supabase.from('restaurants').update({ color }).eq('id', restaurant.id)
    setSaving(false)
    if (error) return
    setRestaurant({ ...restaurant, color })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Opcione akcije — koriste boju iz pickera i usput je perzistuju (postaje izvor).
  const applyAdminTheme = async () => {
    if (!restaurant) return
    setBusy('admin')
    const { error } = await supabase.from('restaurants').update({ color, admin_theme: 'brand' }).eq('id', restaurant.id)
    setBusy(null)
    if (error) { showMsg(t('bsErrorPrefix') + error.message); return }
    setRestaurant({ ...restaurant, color, admin_theme: 'brand' })
    showMsg(t('bsAdminApplied'))
  }

  const applyMenuTemplate = async () => {
    if (!restaurant) return
    setBusy('menu')
    // 'brand' predložak — meni izvodi boje iz brend boje (vidi getTemplate/deriveMenuTemplate).
    const { error } = await supabase.from('restaurants').update({ color, template: 'brand' }).eq('id', restaurant.id)
    setBusy(null)
    if (error) { showMsg(t('bsErrorPrefix') + error.message); return }
    setRestaurant({ ...restaurant, color, template: 'brand' })
    showMsg(t('bsMenuApplied'))
  }

  const previewLight = deriveShades(color).light
  const menuPreview = getTemplate('brand', color)
  const adminActive = restaurant?.admin_theme === 'brand'
  const menuActive = restaurant?.template === 'brand'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('navBrand')}</h1>
        <p className={styles.subtitle}>
          {t('bsSubtitle')}
        </p>
      </div>

      {msg && <div className={styles.banner}>{msg}</div>}

      {/* Boja brenda */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('bsColorTitle')}</div>
        <div className={styles.cardDesc}>{t('bsColorDesc')}</div>
        <div className={styles.colorRow}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className={styles.colorSwatch} aria-label={t('bsColorTitle')} />
          <input value={color} onChange={e => setColor(e.target.value)} className={styles.colorHex} spellCheck={false} />
          <span className={styles.colorPreview} style={{ background: color }} />
          <span style={{ flex: 1 }} />
          {saved && !isDirty && <span className={styles.savedMsg}>✓ {t('saved')}</span>}
          {isDirty && (
            <button className={styles.saveBtn} onClick={saveColor} disabled={saving}>
              {saving ? t('saving') : t('bsSaveColor')}
            </button>
          )}
        </div>
      </div>

      {/* Uskladi sa brendom (opciono, jednosmjerno) */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('bsApplyBrand')}</div>
        <div className={styles.cardDesc}>
          {t('bsApplyBrandDesc')}
        </div>

        {/* Admin tema */}
        <div className={styles.actionRow}>
          <div className={styles.actionPreview}>
            <span className={styles.swatch} style={{ background: previewLight.sbBg }}>
              <span className={styles.swatchDot} style={{ background: previewLight.sbAccent }} />
            </span>
            <span className={styles.swatch} style={{ background: previewLight.primary }} />
          </div>
          <div className={styles.actionInfo}>
            <div className={styles.actionTitle}>{t('bsAdminThemeTitle')} {adminActive && <span className={styles.activeTag}>{t('bsActive')}</span>}</div>
            <div className={styles.actionDesc}>{t('bsAdminThemeDesc')}</div>
          </div>
          <button className={styles.actionBtn} onClick={applyAdminTheme} disabled={busy === 'admin'}>
            {busy === 'admin' ? t('bsApplying') : t('bsApplyAdminTheme')}
          </button>
        </div>

        {/* Meni predložak */}
        <div className={styles.actionRow}>
          <div className={styles.actionPreview}>
            <span className={styles.swatch} style={{ background: menuPreview.brand }} />
            <span className={styles.swatch} style={{ background: menuPreview.catBg }} />
          </div>
          <div className={styles.actionInfo}>
            <div className={styles.actionTitle}>{t('bsMenuTitle')} {menuActive && <span className={styles.activeTag}>{t('bsActive')}</span>}</div>
            <div className={styles.actionDesc}>{t('bsMenuDesc')}</div>
          </div>
          <button className={styles.actionBtn} onClick={applyMenuTemplate} disabled={busy === 'menu'}>
            {busy === 'menu' ? t('bsApplying') : t('bsApplyMenu')}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>{t('bsLogo')}</div>
        <LogoUpload embedded />
      </div>
    </div>
  )
}
