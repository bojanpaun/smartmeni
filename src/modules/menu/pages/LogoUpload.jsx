import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './LogoUpload.module.css'

export default function LogoUpload() {
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
      setError('Podržani formati: JPG, PNG, WebP')
      return
    }
    if (f.size > 2 * 1024 * 1024) {
      setError('Maksimalna veličina fajla je 2MB')
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
      setError('Greška pri uploadu. Pokušaj ponovo.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!restaurant || !confirm('Ukloniti logo?')) return
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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Logo restorana</h1>
        <p className={styles.subtitle}>
          Logo se prikazuje u guest meniju i admin panelu. Preporučen format: kvadratni, min 200×200px.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.uploadCol}>

          {/* Preview — uvijek vidljiv, sa oba oblika */}
          <div className={styles.previewSection}>
            <div className={styles.sectionLabel}>Kako će izgledati</div>
            <div className={styles.previewRow}>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>Guest meni</div>
                <div className={styles.previewCircle}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitial}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>Krug u headeru</div>
              </div>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>Admin panel</div>
                <div className={styles.previewSquare}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitial}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>Kvadrat u sidebaru</div>
              </div>
              <div className={styles.previewItem}>
                <div className={styles.previewLabel}>Topbar (mali)</div>
                <div className={styles.previewTiny}>
                  {displayImg
                    ? <img src={displayImg} alt="Logo" className={styles.previewImg} />
                    : <span className={styles.previewInitialTiny}>{restInitial}</span>
                  }
                </div>
                <div className={styles.previewHint}>26px u headeru</div>
              </div>
            </div>

            {/* Badge koji pokazuje da je ovo novi preview */}
            {preview && (
              <div className={styles.previewBadge}>👆 Preview novog loga — još nije sačuvan</div>
            )}
            {currentLogo && !preview && (
              <div className={styles.currentBadge}>✓ Trenutni logo je aktivan</div>
            )}
          </div>

          {/* Akcije za novi upload */}
          {preview ? (
            <div className={styles.actionRow}>
              <button className={styles.saveBtn} onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Upload u toku...' : 'Sačuvaj logo'}
              </button>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                Odustani
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
                {currentLogo ? 'Klikni da promijeniš logo' : 'Klikni ili prevuci fajl ovdje'}
              </div>
              <div className={styles.dropHint}>JPG, PNG, WebP · Max 2MB</div>
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
              × Ukloni trenutni logo
            </button>
          )}

          {error && <div className={styles.error}>{error}</div>}
          {saved && <div className={styles.success}>✓ Logo je sačuvan i odmah je vidljiv gostima!</div>}
        </div>

        {/* Info kolona */}
        <div className={styles.infoCol}>
          <div className={styles.infoCard}>
            <div className={styles.infoTitle}>Gdje se logo koristi</div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>🍽️</span>
              <div>
                <div className={styles.infoItemTitle}>Guest meni</div>
                <div className={styles.infoItemDesc}>Krug u zaglavlju menija koji gosti vide na telefonu</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>⚙️</span>
              <div>
                <div className={styles.infoItemTitle}>Admin panel</div>
                <div className={styles.infoItemDesc}>Kvadrat pored naziva restorana u sidebaru i headeru</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoIcon}>📧</span>
              <div>
                <div className={styles.infoItemTitle}>Email notifikacije</div>
                <div className={styles.infoItemDesc}>Uključuje se u email porukama koje šalje sistem</div>
              </div>
            </div>
          </div>

          <div className={styles.tipsCard}>
            <div className={styles.tipsTitle}>💡 Savjeti</div>
            <ul className={styles.tipsList}>
              <li>Kvadratni format (1:1) izgleda najbolje</li>
              <li>Bijela ili providna pozadina preporučena</li>
              <li>Minimum 200×200px za oštar prikaz</li>
              <li>Logo se automatski prilagođava veličini</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
