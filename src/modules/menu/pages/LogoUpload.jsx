import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './LogoUpload.module.css'

// `embedded` — kad se renderuje unutar druge stranice (npr. Brend), sakrij vlastiti
// header i page padding (kontejner ih daje).
export default function LogoUpload({ embedded = false }) {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant } = usePlatform()
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const currentLogo = restaurant?.logo_url
  const displayImg = preview || currentLogo
  const restInitial = restaurant?.name?.[0] || 'R'

  const handleFileSelect = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError(t('luErrFormat'))
      return
    }
    if (f.size > 2 * 1024 * 1024) {
      setError(t('luErrSize'))
      return
    }
    setError(null)
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleUpload = async () => {
    if (!file || !restaurant) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `logos/${restaurant.id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('restaurant-assets')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage
        .from('restaurant-assets')
        .getPublicUrl(path)
      const logoUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('restaurants').update({ logo_url: logoUrl }).eq('id', restaurant.id)
      setRestaurant({ ...restaurant, logo_url: logoUrl })
      setFile(null)
      setPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(t('luErrUpload'))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!restaurant || !confirm(t('luConfirmRemove'))) return
    await supabase.from('restaurants').update({ logo_url: null }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, logo_url: null })
    setPreview(null)
    setFile(null)
  }

  const handleCancel = () => {
    setPreview(null)
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <div className={styles.header}>
          <h1 className={styles.title}>{t('luTitle')}</h1>
          <p className={styles.subtitle}>
            {t('luSubtitle')}
          </p>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.uploadCol}>

          {/* Preview — uvijek vidljiv, sa oba oblika */}
          <div className={styles.previewSection}>
            <div className={styles.sectionLabel}>{t('luHowItLooks')}</div>
            <div className={styles.previewRow}>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>{t('luGuestMenu')}</div>
                <div className={styles.previewCircle}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitial}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>{t('luCircleHeader')}</div>
              </div>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>{t('luAdminPanel')}</div>
                <div className={styles.previewSquare}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitial}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>{t('luSquareSidebar')}</div>
              </div>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>{t('luTopbarSmall')}</div>
                <div className={styles.previewTiny}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitialTiny}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>{t('lu26Header')}</div>
              </div>
            </div>

            {/* Badge koji pokazuje da je ovo novi preview */}
            {preview && (
              <div className={styles.previewBadge}>👆 {t('luPreviewBadge')}</div>
            )}
            {currentLogo && !preview && (
              <div className={styles.currentBadge}>✓ {t('luCurrentActive')}</div>
            )}
          </div>

          {/* Akcije za novi upload */}
          {preview ? (
            <div className={styles.actionRow}>
              <button className={styles.saveBtn} onClick={handleUpload} disabled={uploading}>
                {uploading ? t('amUploadInProgress') : t('luSaveLogo')}
              </button>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                {t('cancel')}
              </button>
            </div>
          ) : (
            <div
              className={styles.dropZone}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleFileSelect({ target: { files: [f] } })
              }}
            >
              <div className={styles.dropIcon}>🖼️</div>
              <div className={styles.dropText}>
                {currentLogo ? t('luClickChange') : t('luClickDrop')}
              </div>
              <div className={styles.dropHint}>{t('luFormats')}</div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className={styles.fileInput}
              />
            </div>
          )}

          {currentLogo && !preview && (
            <button className={styles.removeBtn} onClick={handleRemove}>
              × {t('luRemoveCurrent')}
            </button>
          )}

          {error && <div className={styles.error}>{error}</div>}
          {saved && <div className={styles.success}>✓ {t('luSaved')}</div>}
        </div>

        {/* Info kolona */}
        <div className={styles.infoCol}>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>{t('luWhereUsed')}</div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>🍽️</span>
              <div>
                <div className={styles.infoItemTitle}>{t('luGuestMenu')}</div>
                <div className={styles.infoItemDesc}>{t('luGuestMenuDesc')}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>⚙️</span>
              <div>
                <div className={styles.infoItemTitle}>{t('luAdminPanel')}</div>
                <div className={styles.infoItemDesc}>{t('luAdminPanelDesc')}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>📧</span>
              <div>
                <div className={styles.infoItemTitle}>{t('luEmailNotif')}</div>
                <div className={styles.infoItemDesc}>{t('luEmailNotifDesc')}</div>
              </div>
            </div>
          </div>

          <div className={styles.tipsCard}>
            <div className={styles.tipsTitle}>💡 {t('luTips')}</div>
            <ul className={styles.tipsList}>
              <li>{t('luTip1')}</li>
              <li>{t('luTip2')}</li>
              <li>{t('luTip3')}</li>
              <li>{t('luTip4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
