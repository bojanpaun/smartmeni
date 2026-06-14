import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { TEMPLATES } from '../../lib/templates'
import styles from './OnboardingWizard.module.css'

const STEPS = [
  { id: 'profile',  icon: '🏪',  titleKey: 'onbStepProfileTitle',  descKey: 'onbStepProfileDesc' },
  { id: 'template', icon: '🎨',  titleKey: 'onbStepTemplateTitle', descKey: 'onbStepTemplateDesc' },
  { id: 'logo',     icon: '🖼️', titleKey: 'onbStepLogoTitle',     descKey: 'onbStepLogoDesc' },
  { id: 'category', icon: '🗂️', titleKey: 'onbStepCategoryTitle', descKey: 'onbStepCategoryDesc' },
  { id: 'item',     icon: '🍽️', titleKey: 'onbStepItemTitle',     descKey: 'onbStepItemDesc' },
  { id: 'qr',       icon: '📱',  titleKey: 'onbStepQrTitle',       descKey: 'onbStepQrDesc' },
]

export default function OnboardingWizard({ onComplete, onSkip }) {
  const { restaurant, setRestaurant, user } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step data
  const [profile, setProfile] = useState({
    name: restaurant?.name || '',
    location: restaurant?.location || '',
    hours: restaurant?.hours || '',
    phone: restaurant?.phone || '',
    tax_id: restaurant?.tax_id || '',
    vat_number: restaurant?.vat_number || '',
    iban: restaurant?.iban || '',
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
        const tpl = TEMPLATES.find(x => x.id === selectedTemplate) || TEMPLATES[0]
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
        // Re-run zaštita: ako kategorija s tim nazivom već postoji, koristi nju (ne dupliraj).
        const { data: existing } = await supabase.from('categories')
          .select('id').eq('restaurant_id', restaurant.id).eq('name', categoryName.trim()).maybeSingle()
        if (existing) {
          setCreatedCategoryId(existing.id)
        } else {
          const { data } = await supabase.from('categories').insert({
            restaurant_id: restaurant.id,
            name: categoryName.trim(),
            icon: categoryIcon,
            sort_order: 0,
          }).select().single()
          if (data) setCreatedCategoryId(data.id)
        }
      }

      if (current.id === 'item' && itemName.trim() && itemPrice) {
        // Re-run zaštita: preskoči ako stavka s tim nazivom već postoji.
        const { data: existing } = await supabase.from('menu_items')
          .select('id').eq('restaurant_id', restaurant.id).eq('name', itemName.trim()).maybeSingle()
        if (!existing) {
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
            {t('onbSetupRest')}
          </div>
          <button className={styles.skipAllBtn} onClick={handleSkipAll}>
            {t('onbSkipAll')} →
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
              <div className={styles.progressLabel}>{t(s.titleKey)}</div>
            </div>
          ))}
        </div>

        {/* Step sadržaj */}
        <div className={styles.stepContent}>
          <div className={styles.stepIcon}>{current.icon}</div>
          <h2 className={styles.stepTitle}>{t(current.titleKey)}</h2>
          <p className={styles.stepDesc}>{t(current.descKey)}</p>

          {/* PROFIL */}
          {current.id === 'profile' && (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>{t('onbRestNameReq')}</label>
                <input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('onbRestNamePh')}
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>{t('onbLocation')}</label>
                <input
                  value={profile.location}
                  onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                  placeholder={t('onbLocationPh')}
                />
              </div>
              <div className={styles.field}>
                <label>{t('onbHours')}</label>
                <input
                  value={profile.hours}
                  onChange={e => setProfile(p => ({ ...p, hours: e.target.value }))}
                  placeholder={t('onbHoursPh')}
                />
              </div>
              <div className={styles.field}>
                <label>{t('onbPhone')}</label>
                <input
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder={t('onbPhonePh')}
                />
              </div>
              <div className={styles.field}>
                <label>{t('gsTaxId')} <span style={{ color: 'var(--c-text-muted)', fontWeight: 400, fontSize: 12 }}>{t('onbOptional')}</span></label>
                <input
                  value={profile.tax_id}
                  onChange={e => setProfile(p => ({ ...p, tax_id: e.target.value }))}
                  placeholder={t('gsTaxIdPh')}
                />
              </div>
              <div className={styles.field}>
                <label>{t('gsVatNumber')} <span style={{ color: 'var(--c-text-muted)', fontWeight: 400, fontSize: 12 }}>{t('onbOptional')}</span></label>
                <input
                  value={profile.vat_number}
                  onChange={e => setProfile(p => ({ ...p, vat_number: e.target.value }))}
                  placeholder={t('gsVatNumberPh')}
                />
              </div>
              <div className={styles.field}>
                <label>{t('gsIban')} <span style={{ color: 'var(--c-text-muted)', fontWeight: 400, fontSize: 12 }}>{t('onbOptional')}</span></label>
                <input
                  value={profile.iban}
                  onChange={e => setProfile(p => ({ ...p, iban: e.target.value }))}
                  placeholder={t('gsIbanPh')}
                />
              </div>
            </div>
          )}

          {/* TEMPLATE */}
          {current.id === 'template' && (
            <div className={styles.templateGrid}>
              {TEMPLATES.slice(0, 8).map(tpl => (
                <button
                  key={tpl.id}
                  className={`${styles.tcard} ${selectedTemplate === tpl.id ? styles.tcardActive : ''}`}
                  onClick={() => setSelectedTemplate(tpl.id)}
                >
                  <div className={styles.tswatch} style={{ background: tpl.brand }} />
                  <div className={styles.tname}>{tpl.name}</div>
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
                    <div className={styles.logoHint}>{t('onbLogoGuest')}</div>
                  </div>
                  <div className={styles.logoPreviewItem}>
                    <img src={logoPreview} alt="Logo" className={styles.logoSquare} />
                    <div className={styles.logoHint}>{t('onbLogoAdmin')}</div>
                  </div>
                  <button className={styles.logoChangeBtn} onClick={() => { setLogoFile(null); setLogoPreview(null) }}>
                    {t('onbChange')}
                  </button>
                </div>
              ) : (
                <label className={styles.logoDropZone}>
                  <div className={styles.logoDropIcon}>🖼️</div>
                  <div className={styles.logoDropText}>{t('onbLogoDropText')}</div>
                  <div className={styles.logoDropHint}>{t('onbLogoDropHint')}</div>
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
                <label>{t('onbCatNameReq')}</label>
                <input
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  placeholder={t('onbCatNamePh')}
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
                  <label>{t('onbItemNameReq')}</label>
                  <input
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder={t('onbItemNamePh')}
                    autoFocus
                  />
                </div>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label>{t('onbPriceReq')}</label>
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
                <div className={styles.qrSuccessTitle}>{t('onbMenuReady')}</div>
                <div className={styles.qrSuccessDesc}>
                  {t('onbScanDesc')}
                </div>
                {restaurant && (
                  <div className={styles.qrUrl}>
                    restby.me/<strong>{restaurant.slug}</strong>
                  </div>
                )}
                <div className={styles.qrNote}>
                  {t('onbQrNote')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer akcije */}
        <div className={styles.wizardFooter}>
          {step > 0 && (
            <button className={styles.backBtn} onClick={() => setStep(s => s - 1)}>
              ← {t('onbBack')}
            </button>
          )}
          <div className={styles.footerRight}>
            {!isLast && current.id !== 'profile' && current.id !== 'category' && current.id !== 'item' && (
              <button className={styles.skipStepBtn} onClick={() => setStep(s => s + 1)}>
                {t('onbSkip')}
              </button>
            )}
            <button
              className={styles.nextBtn}
              onClick={handleNext}
              disabled={saving || !canProceed()}
            >
              {saving ? t('saving') : isLast ? `🎉 ${t('onbFinishSetup')}` : `${t('onbNext')} →`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
