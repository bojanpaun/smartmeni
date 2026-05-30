import { useState, useEffect } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import ImageUpload from '../../../components/shared/ImageUpload'
import styles from './HotelLandingEditor.module.css'

const BLOCK_DEFS = [
  {
    type: 'hero',
    label: 'Hero sekcija',
    icon: '🖼️',
    desc: 'Naslovna sekcija s pozadinskom slikom i CTA dugmetom',
    defaultEnabled: true,
    fields: [
      { key: 'title',        label: 'Naslov',                  type: 'text',     placeholder: 'Npr. Hotel Mediteran' },
      { key: 'subtitle',     label: 'Podnaslov',               type: 'text',     placeholder: 'Npr. Vaša oaza mira na Jadranskom moru' },
      { key: 'bg_image_url', label: 'Pozadinska slika',         type: 'image' },
      { key: 'cta_text',     label: 'Tekst CTA dugmeta',       type: 'text',     placeholder: 'Rezerviši sobu' },
    ],
    defaultData: { title: '', subtitle: '', bg_image_url: '', cta_text: 'Rezerviši sobu' },
  },
  {
    type: 'about',
    label: 'O hotelu',
    icon: 'ℹ️',
    desc: 'Kratki opis hotela s opcionalnom fotografijom',
    defaultEnabled: false,
    fields: [
      { key: 'text',      label: 'Tekst opisa',            type: 'textarea', placeholder: 'Napišite nešto o hotelu...' },
      { key: 'image_url', label: 'Fotografija (opcionalno)',      type: 'image' },
    ],
    defaultData: { text: '', image_url: '' },
  },
  {
    type: 'rooms',
    label: 'Tipovi smještaja',
    icon: '🛏️',
    desc: 'Automatski prikazuje tipove smještaja iz baze podataka',
    defaultEnabled: true,
    auto: true,
    fields: [],
    defaultData: {},
  },
  {
    type: 'gallery',
    label: 'Galerija',
    icon: '🖼️',
    desc: 'Grid s fotografijama hotela',
    defaultEnabled: false,
    fields: [
      { key: 'image_urls', label: 'Fotografije',                            type: 'image-gallery' },
    ],
    defaultData: { image_urls: '' },
  },
  {
    type: 'amenities',
    label: 'Pogodnosti',
    icon: '✨',
    desc: 'Lista pogodnosti hotela (bazen, parking, WiFi...)',
    defaultEnabled: false,
    fields: [
      { key: 'items', label: 'Pogodnosti (jedna po liniji, npr. "🏊 Bazen")', type: 'textarea', placeholder: '🏊 Bazen\n🅿️ Besplatan parking\n📶 Besplatan WiFi\n🏋️ Teretana' },
    ],
    defaultData: { items: '' },
  },
  {
    type: 'location',
    label: 'Lokacija',
    icon: '📍',
    desc: 'Adresa hotela i opcioni Google Maps embed',
    defaultEnabled: false,
    fields: [
      { key: 'address',        label: 'Adresa',                          type: 'text', placeholder: 'Primorska bb, 85310 Budva' },
      { key: 'maps_embed_url', label: 'Google Maps embed URL (opcionalno)', type: 'url', placeholder: 'https://www.google.com/maps/embed?pb=...' },
    ],
    defaultData: { address: '', maps_embed_url: '' },
  },
  {
    type: 'contact',
    label: 'Kontakt',
    icon: '📞',
    desc: 'Telefon, email i radno vrijeme recepcije',
    defaultEnabled: true,
    fields: [
      { key: 'phone', label: 'Telefon',       type: 'tel',   placeholder: '+382 69 123 456' },
      { key: 'email', label: 'Email',         type: 'email', placeholder: 'info@hotel.me' },
      { key: 'hours', label: 'Radno vrijeme', type: 'text',  placeholder: 'Recepcija 0–24h' },
    ],
    defaultData: { phone: '', email: '', hours: '' },
  },
]

function initBlocks(restaurant) {
  return BLOCK_DEFS.map(def => {
    const data = { ...def.defaultData }
    if (def.type === 'hero')    data.title   = restaurant?.name    || ''
    if (def.type === 'contact') { data.phone = restaurant?.phone   || ''; data.email = restaurant?.email || '' }
    if (def.type === 'location') data.address = restaurant?.address || ''
    return { type: def.type, enabled: def.defaultEnabled, data }
  })
}

function mergeWithDefaults(saved) {
  return BLOCK_DEFS.map(def => {
    const found = saved.find(b => b.type === def.type)
    if (found) return { type: found.type, enabled: found.enabled, data: { ...def.defaultData, ...found.data } }
    return { type: def.type, enabled: def.defaultEnabled, data: { ...def.defaultData } }
  })
}

export default function HotelLandingEditor() {
  const { restaurant } = usePlatform()
  const [blocks, setBlocks] = useState([])
  const [pageId, setPageId] = useState(null)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!restaurant) return
    async function load() {
      const { data } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('page_type', 'hotel')
        .maybeSingle()

      if (data) {
        setPageId(data.id)
        setBlocks(mergeWithDefaults(data.blocks || []))
        setSeoTitle(data.seo_title || '')
        setSeoDescription(data.seo_description || '')
      } else {
        setBlocks(initBlocks(restaurant))
      }
      setLoading(false)
    }
    load()
  }, [restaurant])

  const toggleBlock = (type) =>
    setBlocks(prev => prev.map(b => b.type === type ? { ...b, enabled: !b.enabled } : b))

  const updateField = (type, field, value) =>
    setBlocks(prev => prev.map(b =>
      b.type === type ? { ...b, data: { ...b.data, [field]: value } } : b
    ))

  const moveBlock = (idx, dir) => {
    setBlocks(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const handleSave = async () => {
    if (!restaurant) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      page_type: 'hotel',
      blocks: blocks.map(({ type, enabled, data }) => ({ type, enabled, data })),
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (pageId) {
      ;({ error } = await supabase.from('landing_pages').update(payload).eq('id', pageId))
    } else {
      const { data: created, error: err } = await supabase
        .from('landing_pages').insert(payload).select('id').single()
      error = err
      if (created) setPageId(created.id)
    }
    setSaving(false)
    if (error) { console.error(error); toast.error('Greška pri čuvanju') }
    else toast.success('Sajt hotela sačuvan')
  }

  if (loading) return <div className={styles.loadWrap}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Sajt hotela</h1>
          <p className={styles.subtitle}>Uredite blokove koji se prikazuju na vašoj hotelskoj web stranici</p>
        </div>
        <div className={styles.headerActions}>
          {restaurant && (
            <a href={`/${restaurant.slug}/hotel`} target="_blank" rel="noreferrer" className={styles.previewLink}>
              👁 Vidi sajt
            </a>
          )}
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Čuvanje...' : 'Sačuvaj'}
          </button>
        </div>
      </div>

      <div className={styles.blockList}>
        {blocks.map((block, idx) => {
          const def = BLOCK_DEFS.find(d => d.type === block.type)
          if (!def) return null
          return (
            <div key={block.type} className={`${styles.block} ${block.enabled ? styles.blockEnabled : ''}`}>
              <div className={styles.blockHeader}>
                <span className={styles.blockIcon}>{def.icon}</span>
                <div className={styles.blockMeta}>
                  <div className={styles.blockLabel}>{def.label}</div>
                  <div className={styles.blockDesc}>{def.desc}</div>
                </div>
                <div className={styles.blockActions}>
                  <div className={styles.reorderBtns}>
                    <button className={styles.reorderBtn} onClick={() => moveBlock(idx, -1)} disabled={idx === 0} title="Pomjeri gore">↑</button>
                    <button className={styles.reorderBtn} onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1} title="Pomjeri dole">↓</button>
                  </div>
                  <button
                    className={`${styles.toggleBtn} ${block.enabled ? styles.toggleBtnOn : ''}`}
                    onClick={() => toggleBlock(block.type)}
                  >
                    {block.enabled ? 'Aktivan' : 'Isključen'}
                  </button>
                </div>
              </div>

              {block.enabled && (
                <div className={styles.blockBody}>
                  {def.auto ? (
                    <p className={styles.autoNote}>
                      ℹ️ Ovaj blok automatski generiše sadržaj iz baze podataka i nema polja za konfiguraciju.
                    </p>
                  ) : (
                    def.fields.map(field => (
                      <div key={field.key} className={styles.formRow}>
                        <label className={styles.label}>{field.label}</label>
                        {field.type === 'image' ? (
                          <ImageUpload
                            value={block.data[field.key] || ''}
                            onChange={url => updateField(block.type, field.key, url)}
                            restaurantId={restaurant?.id}
                          />
                        ) : field.type === 'image-gallery' ? (
                          <ImageUpload
                            value={block.data[field.key] || ''}
                            onChange={urls => updateField(block.type, field.key, urls)}
                            restaurantId={restaurant?.id}
                            multiple
                          />
                        ) : field.type === 'textarea' ? (
                          <textarea
                            className={styles.textarea}
                            value={block.data[field.key] || ''}
                            onChange={e => updateField(block.type, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                          />
                        ) : (
                          <input
                            type={field.type}
                            className={styles.input}
                            value={block.data[field.key] || ''}
                            onChange={e => updateField(block.type, field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.seoSection}>
        <h2 className={styles.seoHeading}>SEO postavke</h2>
        <div className={styles.formRow}>
          <label className={styles.label}>SEO naslov (title tag)</label>
          <input
            type="text"
            className={styles.input}
            value={seoTitle}
            onChange={e => setSeoTitle(e.target.value)}
            placeholder={`${restaurant?.name || 'Hotel'} — Rezervacije i smještaj`}
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.label}>SEO opis (meta description, do 160 znakova)</label>
          <textarea
            className={styles.textarea}
            value={seoDescription}
            onChange={e => setSeoDescription(e.target.value)}
            placeholder="Kratki opis hotela za pretraživače..."
            rows={3}
          />
        </div>
      </div>

      <div className={styles.saveRow}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Čuvanje...' : 'Sačuvaj sve promjene'}
        </button>
      </div>
    </div>
  )
}
