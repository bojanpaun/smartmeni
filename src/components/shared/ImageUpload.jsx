import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'react-hot-toast'
import styles from './ImageUpload.module.css'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const BUCKET = 'landing-images'

async function uploadOne(file, restaurantId) {
  if (file.size > MAX_BYTES) {
    toast.error(`Slika "${file.name}" je prevelika (max 5MB)`)
    return null
  }
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${restaurantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) {
    toast.error('Greška pri uploadu slike')
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Single image upload
function SingleUpload({ value, onChange, restaurantId }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  const handle = async (files) => {
    if (!files?.length || !restaurantId) return
    setUploading(true)
    const url = await uploadOne(files[0], restaurantId)
    if (url) onChange(url)
    setUploading(false)
  }

  if (value) {
    return (
      <div className={styles.previewWrap}>
        <img src={value} alt="" className={styles.previewImg} />
        <div className={styles.previewBar}>
          <button
            type="button"
            className={styles.replaceBtn}
            onClick={() => inputRef.current.click()}
            disabled={uploading}
          >
            {uploading ? <span className={styles.spinner} /> : 'Zamijeni'}
          </button>
          <button type="button" className={styles.removeBtn} onClick={() => onChange('')}>
            Ukloni
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={e => handle(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div
      className={`${styles.dropzone} ${uploading ? styles.dropzoneLoading : ''}`}
      onClick={() => !uploading && inputRef.current.click()}
      onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files) }}
      onDragOver={e => e.preventDefault()}
    >
      {uploading
        ? <span className={styles.spinner} />
        : <>
            <span className={styles.dropzoneIcon}>🖼️</span>
            <span className={styles.dropzoneText}>Kliknite ili prevucite sliku</span>
            <span className={styles.dropzoneHint}>JPG, PNG, WebP, GIF · max 5MB</span>
          </>
      }
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files)}
      />
    </div>
  )
}

// Multi-image upload (gallery)
function MultiUpload({ value, onChange, restaurantId }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  const urls = (value || '')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('http'))

  const handle = async (files) => {
    if (!files?.length || !restaurantId) return
    setUploading(true)
    const newUrls = []
    for (const file of Array.from(files)) {
      const url = await uploadOne(file, restaurantId)
      if (url) newUrls.push(url)
    }
    if (newUrls.length) onChange([...urls, ...newUrls].join('\n'))
    setUploading(false)
  }

  const remove = (urlToRemove) => {
    onChange(urls.filter(u => u !== urlToRemove).join('\n'))
  }

  return (
    <div className={styles.gallery}>
      {urls.map((url, i) => (
        <div key={i} className={styles.galleryItem}>
          <img src={url} alt="" className={styles.galleryImg} />
          <button type="button" className={styles.galleryRemove} onClick={() => remove(url)}>✕</button>
        </div>
      ))}
      <div
        className={`${styles.galleryAdd} ${uploading ? styles.galleryAddLoading : ''}`}
        onClick={() => !uploading && inputRef.current.click()}
        onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files) }}
        onDragOver={e => e.preventDefault()}
      >
        {uploading ? <span className={styles.spinner} /> : <span className={styles.addIcon}>+</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files)}
      />
    </div>
  )
}

export default function ImageUpload({ value, onChange, restaurantId, multiple = false }) {
  if (multiple) {
    return <MultiUpload value={value} onChange={onChange} restaurantId={restaurantId} />
  }
  return <SingleUpload value={value} onChange={onChange} restaurantId={restaurantId} />
}
