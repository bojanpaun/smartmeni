import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { TEMPLATES } from '../../lib/templates'
import styles from './OnboardingWizard.module.css'

const STEPS = [
  {
    id: 'profile',
    icon: '🏪',
    title: 'Podaci restorana',
    desc: 'Naziv, lokacija i radno vrijeme — vidljivo gostima',
  },
  {
    id: 'template',
    icon: '🎨',
    title: 'Vizualni stil',
    desc: 'Odaberi boju i stil guest menija',
  },
  {
    id: 'logo',
    icon: '🖼️',
    title: 'Logo',
    desc: 'Postavi logo restorana',
  },
  {
    id: 'category',
    icon: '🗂️',
    title: 'Prva kategorija',
    desc: 'Dodaj kategoriju menija (npr. Predjela, Pizza...)',
  },
  {
    id: 'item',
    icon: '🍽️',
    title: 'Prvo jelo',
    desc: 'Dodaj prvo jelo ili piće u meni',
  },
  {
    id: 'qr',
    icon: '📱',
    title: 'QR kod',
    desc: 'Tvoj meni je spreman — podijeli ga sa gostima',
  },
]

export default function OnboardingWizard({ onComplete, onSkip }) {
  const { restaurant, setRestaurant, user } = usePlatform()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step data
  const [profile, setProfile] = useState({
    name: restaurant?.name || '',
    location: restaurant?.location || '',
    hours: restaurant?.hours || '',
    phone: restaurant?.phone || '',
  })
  const [selectedTemplate, setSelectedTemplate] = useState(restaurant?.template || 'modern_minimal')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryIcon, setCategoryIcon] = useState('🍽️')
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemEmoji, setItemEmoji] = useState('🍽️')
  const [createdCategoryId, setCreatedCategoryId] = useState(null)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleNext = async () => {
    setSaving(true)
    try {
      if (current.id === 'profile') {
        await supabase.from('restaurants').update(profile).eq('id', restaurant.id)
        setRestaurant({ ...restaurant, ...profile })
      }

      if (current.id === 'template') {
        const tpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0]
        await supabase.from('restaurants')
          .update({ template: selectedTemplate, color: tpl.brand })
          .eq('id', restaurant.id)
        setRestaurant({ ...restaurant, template: selectedTemplate, color: tpl.brand })
      }

      if (current.id === 'logo' && logoFile) {
        const ext = logoFile.name.split('.').pop().toLowerCase()
        const path = `logos/${restaurant.id}/logo.${ext}`
        const { error } = await supabase.storage
          .from('restaurant-assets')
          .upload(path, logoFile, { upsert: true })
        if (!error) {
          const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
          const logoUrl = `${data.publicUrl}?t=${Date.now()}`
          await supabase.from('restaurants').update({ logo_url: logoUrl }).eq('id', restaurant.id)
          setRestaurant({ ...restaurant, logo_url: logoUrl })
        }
      }

      if (current.id === 'category' && categoryName.trim()) {
        const { data } = await supabase.from('categories').insert({
          restaurant_id: restaurant.id,
          name: categoryName.trim(),
          icon: categoryIcon,
          sort_order: 0,
        }).select().single()
        if (data) setCreatedCategoryId(data.id)
      }

      if (current.id === 'item' && itemName.trim() && itemPrice) {
        await supabase.from('menu_items').insert({
          restaurant_id: restaurant.id,
          category_id: createdCategoryId,
          name: itemName.trim(),
          price: parseFloat(itemPrice),
          emoji: itemEmoji,
          is_visible: true,
          sort_order: 0,
        })
      }

      if (isLast) {
        await supabase.from('restaurants')
          .update({ onboarding_completed: true })
          .eq('id', restaurant.id)
        setRestaurant({ ...restaurant, onboarding_completed: true })
        onComplete?.()
        navigate('/admin')
        return
      }

      setStep(s => s + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipAll = async () => {
    await supabase.from('restaurants')
      .update({ onboarding_completed: true })
      .eq('id', restaurant.id)
    setRestaurant({ ...restaurant, onboarding_completed: true })
    onSkip?.()
    navigate('/admin')
  }

  const handleLogoSelect = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setLogoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const canProceed = () => {
    if (current.id === 'profile') return profile.name.trim().length > 0
    if (current.id === 'category') return categoryName.trim().length > 0
    if (current.id === 'item') return itemName.trim().length > 0 && itemPrice.length > 0
    return true // template, logo, qr mogu proći prazni
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.wizard}>

        {/* Header */}
        <div className={styles.wizardHeader}>
          <div className={styles.wizardTitle}>
            Postavljanje restorana
          </div>
          <button className={styles.skipAllBtn} onClick={handleSkipAll}>
            Preskoči sve →
          </button>
        </div>

        {/* Progress */}
        <div className={styles.progress}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`${styles.progressStep} ${i < step ? styles.progressDone : ''} ${i === step ? styles.progressActive : ''}`}
              onClick={() => i < step && setStep(i)}
            >
              <div className={styles.progressDot}>
                {i < step ? '✓' : i + 1}
              </div>
              <div className={styles.progressLabel}>{s.title}</div>
            </div>
          ))}
        </div>

        {/* Step sadržaj */}
        <div className={styles.stepContent}>
          <div className={styles.stepIcon}>{current.icon}</div>
          <h2 className={styles.stepTitle}>{current.title}</h2>
          <p className={styles.stepDesc}>{current.desc}</p>

          {/* PROFIL */}
          {current.id === 'profile' && (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Naziv restorana *</label>
                <input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="npr. Pizzeria Napoli"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Lokacija</label>
                <input
                  value={profile.location}
                  onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                  placeholder="npr. Budva, Crna Gora"
                />
              </div>
              <div className={styles.field}>
                <label>Radno vrijeme</label>
                <input
                  value={profile.hours}
                  onChange={e => setProfile(p => ({ ...p, hours: e.target.value }))}
                  placeholder="npr. 09:00 – 23:00"
                />
              </div>
              <div className={styles.field}>
                <label>Telefon</label>
                <input
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="npr. +382 67 123 456"
                />
              </div>
            </div>
          )}

          {/* TEMPLATE */}
          {current.id === 'template' && (
            <div className={styles.templateGrid}>
              {TEMPLATES.slice(0, 8).map(t => (
                <button
                  key={t.id}
                  className={`${styles.tcard} ${selectedTemplate === t.id ? styles.tcardActive : ''}`}
                  onClick={() => setSelectedTemplate(t.id)}
                >
                  <div className={styles.tswatch} style={{ background: t.brand }} />
                  <div className={styles.tname}>{t.name}</div>
                </button>
              ))}
            </div>
          )}

          {/* LOGO */}
          {current.id === 'logo' && (
            <div className={styles.logoSection}>
              {logoPreview ? (
                <div className={styles.logoPreviewRow}>
                  <div className={styles.logoPreviewItem}>
                    <img src={logoPreview} alt="Logo" className={styles.logoCircle} />
                    <div className={styles.logoHint}>Guest meni</div>
                  </div>
                  <div className={styles.logoPreviewItem}>
                    <img src={logoPreview} alt="Logo" className={styles.logoSquare} />
                    <div className={styles.logoHint}>Admin panel</div>
                  </div>
                  <button className={styles.logoChangeBtn} onClick={() => { setLogoFile(null); setLogoPreview(null) }}>
                    Promijeni
                  </button>
                </div>
              ) : (
                <label className={styles.logoDropZone}>
                  <div className={styles.logoDropIcon}>🖼️</div>
                  <div className={styles.logoDropText}>Klikni da odabereš logo</div>
                  <div className={styles.logoDropHint}>JPG, PNG, WebP · Max 2MB · Nije obavezno</div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoSelect} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          )}

          {/* KATEGORIJA */}
          {current.id === 'category' && (
            <div className={styles.simpleForm}>
              <div className={styles.emojiRow}>
                {['🍕', '🍔', '🍗', '🥗', '🐟', '🍷', '☕', '🍰', '🥩', '🍽️'].map(e => (
                  <button
                    key={e}
                    className={`${styles.emojiBtn} ${categoryIcon === e ? styles.emojiBtnActive : ''}`}
                    onClick={() => setCategoryIcon(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label>Naziv kategorije *</label>
                <input
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  placeholder="npr. Predjela, Pizza, Piće..."
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* JELO */}
          {current.id === 'item' && (
            <div className={styles.simpleForm}>
              <div className={styles.emojiRow}>
                {['🍕', '🍔', '🥗', '🍗', '🐟', '🍷', '☕', '🍰', '🥩', '🍽️'].map(e => (
                  <button
                    key={e}
                    className={`${styles.emojiBtn} ${itemEmoji === e ? styles.emojiBtnActive : ''}`}
                    onClick={() => setItemEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className={styles.formRow}>
                <div className={styles.field} style={{ flex: 2 }}>
                  <label>Naziv jela *</label>
                  <input
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder="npr. Margherita"
                    autoFocus
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label>Cijena (€) *</label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={itemPrice}
                    onChange={e => setItemPrice(e.target.value)}
                    placeholder="7.50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* QR */}
          {current.id === 'qr' && (
            <div className={styles.qrSection}>
              <div className={styles.qrSuccess}>
                <div className={styles.qrSuccessIcon}>🎉</div>
                <div className={styles.qrSuccessTitle}>Meni je spreman!</div>
                <div className={styles.qrSuccessDesc}>
                  Gosti mogu skenirati QR kod ili otvoriti direktan link:
                </div>
                {restaurant && (
                  <div className={styles.qrUrl}>
                    smartmeni.me/<strong>{restaurant.slug}</strong>
                  </div>
                )}
                <div className={styles.qrNote}>
                  Detaljan QR kod za štampu naći ćeš u meniju pod QR kod sekcijonom.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer akcije */}
        <div className={styles.wizardFooter}>
          {step > 0 && (
            <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
              ← Nazad
            </button>
          )}
          <div className={styles.footerRight}>
            {!isLast && current.id !== 'profile' && current.id !== 'category' && current.id !== 'item' && (
              <button className={styles.skipStepBtn} onClick={() => setStep(s => s + 1)}>
                Preskoči
              </button>
            )}
            <button
              className={styles.nextBtn}
              onClick={handleNext}
              disabled={saving || !canProceed()}
            >
              {saving ? 'Čuvanje...' : isLast ? '🎉 Završi postavljanje' : 'Dalje →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
