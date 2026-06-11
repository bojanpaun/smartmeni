import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { deriveShades, hexToRgb } from '../../../lib/brandPalette'
import { TEMPLATES } from '../../../lib/templates'
import LogoUpload from './LogoUpload'
import styles from './BrandSettings.module.css'

// Kanonski izvor brend identiteta tenanta: LOGO + BOJA BRENDA (restaurants.color).
// Iz boje brenda se OPCIONO (jednosmjerno, „predloži default") izvode:
//   • admin tema  → admin_theme = 'brand' (useTheme je izvodi uživo iz color-a)
//   • predložak menija → najbliži postojeći predložak boji brenda
// Sve ostaje nadjačivo u Postavke → Tema, odn. Meni → Predlošci.

// Najbliži predložak menija po boji (RGB euklidska distanca brend boje).
function nearestTemplate(hex) {
  const c = hexToRgb(hex)
  let best = TEMPLATES[0], bestD = Infinity
  for (const t of TEMPLATES) {
    const tc = hexToRgb(t.brand)
    const d = (c.r - tc.r) ** 2 + (c.g - tc.g) ** 2 + (c.b - tc.b) ** 2
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

export default function BrandSettings() {
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
  const showMsg = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3500) }

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
    if (error) { showMsg('Greška: ' + error.message); return }
    setRestaurant({ ...restaurant, color, admin_theme: 'brand' })
    showMsg('✓ Admin tema usklađena sa brendom. (Promjenljivo u Postavke → Tema.)')
  }

  const applyMenuTemplate = async () => {
    if (!restaurant) return
    const t = nearestTemplate(color)
    setBusy('menu')
    const { error } = await supabase.from('restaurants').update({ color, template: t.id }).eq('id', restaurant.id)
    setBusy(null)
    if (error) { showMsg('Greška: ' + error.message); return }
    setRestaurant({ ...restaurant, color, template: t.id })
    showMsg(`✓ Meni usklađen — predložak „${t.name}". (Promjenljivo u Meni → Predlošci.)`)
  }

  const previewLight = deriveShades(color).light
  const adminActive = restaurant?.admin_theme === 'brand'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Brend</h1>
        <p className={styles.subtitle}>
          Logo i boja brenda tvog objekta — jedinstveni vizuelni identitet. Koriste se na portalu
          zaposlenih, QR kodovima i u email porukama, a mogu se primijeniti i na admin temu i meni.
        </p>
      </div>

      {msg && <div className={styles.banner}>{msg}</div>}

      {/* Boja brenda */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Boja brenda</div>
        <div className={styles.cardDesc}>Glavna boja tvog brenda. Bira se kao boja ili upisuje kao hex.</div>
        <div className={styles.colorRow}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className={styles.colorSwatch} aria-label="Boja brenda" />
          <input value={color} onChange={e => setColor(e.target.value)} className={styles.colorHex} spellCheck={false} />
          <span className={styles.colorPreview} style={{ background: color }} />
          <span style={{ flex: 1 }} />
          {saved && !isDirty && <span className={styles.savedMsg}>✓ Sačuvano</span>}
          {isDirty && (
            <button className={styles.saveBtn} onClick={saveColor} disabled={saving}>
              {saving ? 'Čuvanje…' : 'Sačuvaj boju'}
            </button>
          )}
        </div>
      </div>

      {/* Uskladi sa brendom (opciono, jednosmjerno) */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Primijeni brend</div>
        <div className={styles.cardDesc}>
          Iskoristi boju brenda kao polaznu tačku za admin temu i izgled menija. Sve ostaje
          ručno promjenljivo kasnije (Postavke → Tema, Meni → Predlošci).
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
            <div className={styles.actionTitle}>Admin tema iz brenda {adminActive && <span className={styles.activeTag}>aktivno</span>}</div>
            <div className={styles.actionDesc}>Generiše paletu admin panela (light + dark) iz boje brenda.</div>
          </div>
          <button className={styles.actionBtn} onClick={applyAdminTheme} disabled={busy === 'admin'}>
            {busy === 'admin' ? 'Primjena…' : 'Uskladi admin temu'}
          </button>
        </div>

        {/* Meni predložak */}
        <div className={styles.actionRow}>
          <div className={styles.actionPreview}>
            <span className={styles.swatch} style={{ background: nearestTemplate(color).brand }} />
            <span className={styles.swatch} style={{ background: nearestTemplate(color).catBg }} />
          </div>
          <div className={styles.actionInfo}>
            <div className={styles.actionTitle}>Meni iz brenda</div>
            <div className={styles.actionDesc}>Postavlja najbliži predložak menija: „{nearestTemplate(color).name}".</div>
          </div>
          <button className={styles.actionBtn} onClick={applyMenuTemplate} disabled={busy === 'menu'}>
            {busy === 'menu' ? 'Primjena…' : 'Uskladi meni'}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Logo</div>
        <LogoUpload embedded />
      </div>
    </div>
  )
}
