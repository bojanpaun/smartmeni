import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import BlockSortable from '../../../components/shared/BlockSortable'
import LandingPreview from '../../../components/shared/LandingPreview'
import BlockLayoutPicker from '../../../components/shared/BlockLayoutPicker'
import BlockFieldRenderer from '../../../components/shared/BlockFieldRenderer'
import styles from '../../../components/shared/LandingEditor.module.css'

const BLOCK_DEFS = [
  {
    type: 'hero', label: 'Hero sekcija', icon: '🖼️', hasLayout: true,
    desc: 'Naslovna sekcija s pozadinskom slikom i CTA dugmetom', defaultEnabled: true,
    fields: [
      { key: 'title',        label: 'Naslov',             type: 'text',  placeholder: 'Npr. Hotel Mediteran' },
      { key: 'subtitle',     label: 'Podnaslov',          type: 'text',  placeholder: 'Vaša oaza mira na Jadranskom moru' },
      { key: 'bg_image_url', label: 'Pozadinska slika',   type: 'image' },
      { key: 'cta_text',     label: 'Tekst CTA dugmeta',  type: 'text',  placeholder: 'Rezerviši sobu' },
    ],
    defaultData: { title: '', subtitle: '', bg_image_url: '', cta_text: 'Rezerviši sobu', layout: 'fullscreen' },
  },
  {
    type: 'about', label: 'O hotelu', icon: 'ℹ️', hasLayout: true,
    desc: 'Kratki opis hotela s opcionalnom fotografijom', defaultEnabled: false,
    fields: [
      { key: 'text',      label: 'Tekst opisa',   type: 'textarea', placeholder: 'Napišite nešto o hotelu...' },
      { key: 'image_url', label: 'Fotografija',    type: 'image' },
    ],
    defaultData: { text: '', image_url: '', layout: 'image-right' },
  },
  {
    type: 'rooms', label: 'Tipovi smještaja', icon: '🛏️',
    desc: 'Automatski prikazuje tipove smještaja iz baze podataka', defaultEnabled: true,
    auto: true, fields: [], defaultData: {},
  },
  {
    type: 'gallery', label: 'Galerija', icon: '🖼️', hasLayout: true,
    desc: 'Grid s fotografijama hotela', defaultEnabled: false,
    fields: [{ key: 'image_urls', label: 'Fotografije', type: 'image-gallery' }],
    defaultData: { image_urls: '', layout: 'grid-3' },
  },
  {
    type: 'amenities', label: 'Pogodnosti', icon: '✨', hasLayout: true,
    desc: 'Lista pogodnosti hotela (bazen, parking, WiFi...)', defaultEnabled: false,
    fields: [{ key: 'items', label: 'Pogodnosti (jedna po liniji)', type: 'textarea', placeholder: '🏊 Bazen\n🅿️ Besplatan parking\n📶 Besplatan WiFi\n🏋️ Teretana', rows: 6 }],
    defaultData: { items: '', layout: 'icons-row' },
  },
  {
    type: 'reviews', label: 'Recenzije', icon: '⭐', hasLayout: true,
    desc: 'Recenzije gostiju sa zvjezdicama', defaultEnabled: false,
    fields: [{ key: 'reviews', label: 'Recenzije', type: 'reviews-list' }],
    defaultData: { reviews: [], layout: 'cards' },
  },
  {
    type: 'video', label: 'Video', icon: '🎬', hasLayout: true,
    desc: 'YouTube ili Vimeo video embed', defaultEnabled: false,
    fields: [
      { key: 'title',     label: 'Naslov (opcionalno)',    type: 'text',      placeholder: 'Pogledajte naš hotel' },
      { key: 'video_url', label: 'YouTube ili Vimeo URL', type: 'video-url' },
    ],
    defaultData: { title: '', video_url: '', layout: 'full' },
  },
  {
    type: 'faq', label: 'FAQ', icon: '❓', hasLayout: true,
    desc: 'Česta pitanja i odgovori', defaultEnabled: false,
    fields: [{ key: 'faq', label: 'Pitanja i odgovori', type: 'faq-list' }],
    defaultData: { faq: [], layout: 'default' },
  },
  {
    type: 'cta_banner', label: 'CTA Banner', icon: '📢', hasLayout: true,
    desc: 'Promotivni strip sa pozivom na akciju', defaultEnabled: false,
    fields: [
      { key: 'title',    label: 'Naslov',           type: 'text', placeholder: 'Posebna ponuda!' },
      { key: 'subtitle', label: 'Opis (opcionalno)', type: 'text', placeholder: 'Rezerviši do 15. juna i uštedi 20%' },
      { key: 'btn_text', label: 'Tekst dugmeta',    type: 'text', placeholder: 'Rezerviši sada' },
      { key: 'btn_link', label: 'Link dugmeta',     type: 'url',  placeholder: 'https://...' },
    ],
    defaultData: { title: '', subtitle: '', btn_text: '', btn_link: '', layout: 'centered' },
  },
  {
    type: 'location', label: 'Lokacija', icon: '📍', hasLayout: true,
    desc: 'Adresa hotela i opcioni Google Maps embed', defaultEnabled: false,
    fields: [
      { key: 'address',        label: 'Adresa',               type: 'text', placeholder: 'Primorska bb, 85310 Budva' },
      { key: 'maps_embed_url', label: 'Google Maps embed URL', type: 'url',  placeholder: 'https://www.google.com/maps/embed?pb=...', hint: 'Google Maps → Share → Embed a map → kopirajte URL iz src="…"' },
    ],
    defaultData: { address: '', maps_embed_url: '', layout: 'card-with-map' },
  },
  {
    type: 'contact', label: 'Kontakt', icon: '📞', hasLayout: true,
    desc: 'Telefon, email i radno vrijeme recepcije', defaultEnabled: true,
    fields: [
      { key: 'phone', label: 'Telefon',       type: 'tel',   placeholder: '+382 69 123 456' },
      { key: 'email', label: 'Email',         type: 'email', placeholder: 'info@hotel.me' },
      { key: 'hours', label: 'Radno vrijeme', type: 'text',  placeholder: 'Recepcija 0–24h' },
    ],
    defaultData: { phone: '', email: '', hours: '', layout: 'card' },
  },
]

function initBlocks(restaurant) {
  return BLOCK_DEFS.map(def => {
    const data = { ...def.defaultData }
    if (def.type === 'hero')     { data.title = restaurant?.name || '' }
    if (def.type === 'contact')  { data.phone = restaurant?.phone || ''; data.email = restaurant?.email || '' }
    if (def.type === 'location') { data.address = restaurant?.address || '' }
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
  const [seoDesc, setSeoDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set(BLOCK_DEFS.map(d => d.type)))
  const [showPreview, setShowPreview] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const dragRef = useRef({ active: false, startX: 0, startW: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

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
        setSeoDesc(data.seo_description || '')
      } else {
        setBlocks(initBlocks(restaurant))
      }
      setLoading(false)
    }
    load()
  }, [restaurant])

  const toggleBlock = (type) =>
    setBlocks(prev => prev.map(b => b.type === type ? { ...b, enabled: !b.enabled } : b))

  const toggleCollapse = (type) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })

  const onDividerMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startW: panelWidth }
    const onMove = (e) => {
      if (!dragRef.current.active) return
      const delta = e.clientX - dragRef.current.startX
      setPanelWidth(Math.max(280, Math.min(700, dragRef.current.startW + delta)))
    }
    const onUp = () => {
      dragRef.current.active = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const updateField = (type, field, value) =>
    setBlocks(prev => prev.map(b =>
      b.type === type ? { ...b, data: { ...b.data, [field]: value } } : b
    ))

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setBlocks(prev => {
      const oldIdx = prev.findIndex(b => b.type === active.id)
      const newIdx = prev.findIndex(b => b.type === over.id)
      return arrayMove(prev, oldIdx, newIdx)
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
      seo_description: seoDesc.trim() || null,
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

  const previewSrc = restaurant ? `/${restaurant.slug}/hotel?preview=true` : null

  return (
    <div className={styles.editorShell}>
      {/* ── Form panel ── */}
      <div className={styles.formPanel} style={{ width: showPreview ? panelWidth : undefined, maxWidth: showPreview ? undefined : 760 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Sajt hotela</h1>
            <p className={styles.subtitle}>Uređujte blokove i pratite promjene u realnom vremenu</p>
          </div>
          <div className={styles.headerActions}>
            {previewSrc && (
              <button
                className={`${styles.previewToggleBtn} ${showPreview ? styles.previewToggleBtnOn : ''}`}
                onClick={() => setShowPreview(v => !v)}
              >
                {showPreview ? '✕ Preview' : '👁 Preview'}
              </button>
            )}
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.type)} strategy={verticalListSortingStrategy}>
            <div className={styles.blockList}>
              {blocks.map((block) => {
                const def = BLOCK_DEFS.find(d => d.type === block.type)
                if (!def) return null
                return (
                  <BlockSortable key={block.type} id={block.type}>
                    {({ dragHandleProps }) => (
                      <div className={`${styles.block} ${block.enabled ? styles.blockEnabled : ''}`}>
                        <div
                          className={styles.blockHeader}
                          onClick={() => toggleCollapse(block.type)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className={styles.dragHandle} {...dragHandleProps} title="Prevuci za reorder" onClick={e => e.stopPropagation()}>⠿</span>
                          <span className={styles.blockIcon}>{def.icon}</span>
                          <div className={styles.blockMeta}>
                            <div className={styles.blockLabel}>{def.label}</div>
                            <div className={styles.blockDesc}>{def.desc}</div>
                          </div>
                          <div className={styles.blockActions}>
                            <button
                              className={`${styles.toggleBtn} ${block.enabled ? styles.toggleBtnOn : ''}`}
                              onClick={e => { e.stopPropagation(); toggleBlock(block.type) }}
                            >
                              {block.enabled ? 'Aktivan' : 'Isključen'}
                            </button>
                            <button className={styles.collapseBtn} onClick={e => { e.stopPropagation(); toggleCollapse(block.type) }}>
                              <span className={`${styles.chevron} ${!collapsed.has(block.type) ? styles.chevronOpen : ''}`}>›</span>
                            </button>
                          </div>
                        </div>

                        {block.enabled && !collapsed.has(block.type) && (
                          <div className={styles.blockBody}>
                            {def.hasLayout && (
                              <BlockLayoutPicker
                                blockType={block.type}
                                value={block.data.layout}
                                onChange={v => updateField(block.type, 'layout', v)}
                              />
                            )}
                            {def.auto ? (
                              <p className={styles.autoNote}>
                                ℹ️ Ovaj blok automatski generiše sadržaj iz baze podataka.
                              </p>
                            ) : (
                              def.fields.map(field => (
                                <div key={field.key} className={styles.formRow}>
                                  {field.label && <label className={styles.label}>{field.label}</label>}
                                  <BlockFieldRenderer
                                    field={field}
                                    value={block.data[field.key]}
                                    onChange={val => updateField(block.type, field.key, val)}
                                    restaurantId={restaurant?.id}
                                  />
                                  {field.hint && <p className={styles.fieldHint}>{field.hint}</p>}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </BlockSortable>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className={styles.seoSection}>
          <h2 className={styles.seoHeading}>SEO postavke</h2>
          <div className={styles.formRow}>
            <label className={styles.label}>SEO naslov (title tag)</label>
            <input type="text" className={styles.input} value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={`${restaurant?.name || 'Hotel'} — Rezervacije i smještaj`} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>SEO opis (meta description, do 160 znakova)</label>
            <textarea className={styles.textarea} value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder="Kratki opis hotela za pretraživače..." rows={3} />
          </div>
        </div>

        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Čuvanje...' : 'Sačuvaj sve promjene'}
          </button>
        </div>
      </div>

      {/* ── Preview panel ── */}
      {showPreview && previewSrc && (
        <>
          <div className={styles.panelDivider} onMouseDown={onDividerMouseDown} />
          <LandingPreview src={previewSrc} blocks={blocks} onClose={() => setShowPreview(false)} />
        </>
      )}
    </div>
  )
}
