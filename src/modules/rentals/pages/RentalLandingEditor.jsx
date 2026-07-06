import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { translateContent, landingBlockFields } from '../../../lib/contentTranslate'
import BlockSortable from '../../../components/shared/BlockSortable'
import LandingPreview from '../../../components/shared/LandingPreview'
import BlockLayoutPicker, { ColSplitPicker } from '../../../components/shared/BlockLayoutPicker'
import BlockFieldRenderer from '../../../components/shared/BlockFieldRenderer'
import styles from '../../../components/shared/LandingEditor.module.css'

// Editor rental landing hub-a (/:slug/rentals). Ogledalo HotelLandingEditor — dijeli
// SVU mašineriju (DnD, preview, BlockFieldRenderer, save u landing_pages, AI prevod);
// razlika je samo BLOCK_DEFS + page_type='rental'. Chrome ključevi su generički (rle*).

const BLOCK_DEFS = [
  {
    type: 'hero', labelKey: 'rlHero', descKey: 'rlHeroD', icon: '🖼️', hasLayout: true, defaultEnabled: true,
    fields: [
      { key: 'title',        labelKey: 'hlFTitle',    type: 'text',  placeholder: 'Vile & apartmani Adriatik' },
      { key: 'subtitle',     labelKey: 'hlFSubtitle', type: 'text',  placeholder: 'Vaš dom na obali Jadrana' },
      { key: 'bg_image_url', labelKey: 'hlFBgImage',  type: 'image' },
      { key: 'cta_text',     labelKey: 'hlFCta',      type: 'text',  placeholder: 'Rezerviši smještaj' },
    ],
    defaultData: { title: '', subtitle: '', bg_image_url: '', cta_text: 'Rezerviši smještaj', layout: 'fullscreen' },
  },
  {
    type: 'about', labelKey: 'rlAbout', descKey: 'rlAboutD', icon: 'ℹ️', hasLayout: true, hasColSplit: true, defaultEnabled: false,
    fields: [
      { key: 'text',      labelKey: 'hlFAboutText', type: 'textarea', placeholder: 'Napišite nešto o vašem najmu...' },
      { key: 'image_url', labelKey: 'hlFPhoto',     type: 'image' },
    ],
    defaultData: { text: '', image_url: '', layout: 'image-right', col_split: '50-50' },
  },
  {
    type: 'accommodation', labelKey: 'rlAccommodation', descKey: 'rlAccommodationD', icon: '🏠',
    defaultEnabled: true, auto: true, fields: [], defaultData: {},
  },
  {
    type: 'gallery', labelKey: 'rlGallery', descKey: 'rlGalleryD', icon: '🖼️', hasLayout: true, defaultEnabled: false,
    fields: [{ key: 'image_urls', labelKey: 'hlFPhotos', type: 'image-gallery' }],
    defaultData: { image_urls: '', layout: 'grid-3' },
  },
  {
    type: 'amenities', labelKey: 'rlAmenities', descKey: 'rlAmenitiesD', icon: '✨', hasLayout: true, defaultEnabled: false,
    fields: [{ key: 'items', labelKey: 'hlFAmenitiesItems', type: 'textarea', placeholder: '🏊 Bazen\n🅿️ Parking\n📶 WiFi\n🌊 Pogled na more', rows: 6 }],
    defaultData: { items: '', layout: 'icons-row' },
  },
  {
    type: 'reviews', labelKey: 'rlReviews', descKey: 'rlReviewsD', icon: '⭐', hasLayout: true, defaultEnabled: false,
    fields: [{ key: 'reviews', labelKey: 'hlFReviews', type: 'reviews-list' }],
    defaultData: { reviews: [], layout: 'cards' },
  },
  {
    type: 'cta_banner', labelKey: 'rlCtaBanner', descKey: 'rlCtaBannerD', icon: '📢', hasLayout: true, defaultEnabled: false,
    fields: [
      { key: 'title',    labelKey: 'hlFTitle',   type: 'text', placeholder: 'Ljetna ponuda!' },
      { key: 'subtitle', labelKey: 'hlFCtaSub',  type: 'text', placeholder: 'Rezerviši ranije i uštedi' },
      { key: 'btn_text', labelKey: 'hlFBtnText', type: 'text', placeholder: 'Rezerviši sada' },
      { key: 'btn_link', labelKey: 'hlFBtnLink', type: 'url',  placeholder: 'https://...' },
    ],
    defaultData: { title: '', subtitle: '', btn_text: '', btn_link: '', layout: 'centered' },
  },
  {
    type: 'location', labelKey: 'rlLocation', descKey: 'rlLocationD', icon: '📍', hasLayout: true, defaultEnabled: false,
    fields: [
      { key: 'address',        labelKey: 'hlFAddress', type: 'text', placeholder: 'Njegoševa 4, 85310 Budva' },
      { key: 'maps_embed_url', labelKey: 'hlFMapsUrl', type: 'url',  placeholder: 'https://www.google.com/maps/embed?pb=...', hintKey: 'hlHMaps' },
    ],
    defaultData: { address: '', maps_embed_url: '', layout: 'card-with-map' },
  },
  {
    type: 'contact', labelKey: 'rlContact', descKey: 'rlContactD', icon: '📞', hasLayout: true, defaultEnabled: true,
    fields: [
      { key: 'phone', labelKey: 'htPhone', type: 'tel',   placeholder: '+382 69 123 456' },
      { key: 'email', labelKey: 'htEmail', type: 'email', placeholder: 'info@najam.me' },
      { key: 'hours', labelKey: 'hlFHours', type: 'text', placeholder: 'Dostupni 0–24h' },
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

export default function RentalLandingEditor() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
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
        .from('landing_pages').select('*')
        .eq('restaurant_id', restaurant.id).eq('page_type', 'rental').maybeSingle()
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

  const toggleBlock = (type) => setBlocks(prev => prev.map(b => b.type === type ? { ...b, enabled: !b.enabled } : b))
  const toggleCollapse = (type) => setCollapsed(prev => {
    const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next
  })
  const updateField = (type, field, value) => setBlocks(prev => prev.map(b =>
    b.type === type ? { ...b, data: { ...b.data, [field]: value } } : b))
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setBlocks(prev => arrayMove(prev, prev.findIndex(b => b.type === active.id), prev.findIndex(b => b.type === over.id)))
  }

  const onDividerMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startW: panelWidth }
    const onMove = (e) => {
      if (!dragRef.current.active) return
      setPanelWidth(Math.max(280, Math.min(700, dragRef.current.startW + (e.clientX - dragRef.current.startX))))
    }
    const onUp = () => { dragRef.current.active = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const handleSave = async () => {
    if (!restaurant) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id, page_type: 'rental',
      blocks: blocks.map(({ type, enabled, data }) => ({ type, enabled, data })),
      seo_title: seoTitle.trim() || null, seo_description: seoDesc.trim() || null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (pageId) { ({ error } = await supabase.from('landing_pages').update(payload).eq('id', pageId)) }
    else {
      const { data: created, error: err } = await supabase.from('landing_pages').insert(payload).select('id').single()
      error = err; if (created) setPageId(created.id)
    }
    setSaving(false)
    if (error) { console.error(error); toast.error(t('htSaveErr')) }
    else {
      toast.success(t('rlRentalSiteSaved'))
      translateContent(restaurant.id, landingBlockFields(restaurant.id, 'rental', blocks)).catch(() => {})
    }
  }

  if (loading) return <div className={styles.loadWrap}>{t('loading')}</div>
  const previewSrc = restaurant ? `/${restaurant.slug}/rentals?preview=true` : null

  return (
    <div className={styles.editorShell}>
      <div className={styles.formPanel} style={{ width: showPreview ? panelWidth : undefined, maxWidth: showPreview ? undefined : 760 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('rlRentalSite')}</h1>
            <p className={styles.subtitle}>{t('rleSubtitle')}</p>
          </div>
          <div className={styles.headerActions}>
            {previewSrc && (
              <>
                <button className={`${styles.previewToggleBtn} ${showPreview ? styles.previewToggleBtnOn : ''}`} onClick={() => setShowPreview(v => !v)}>
                  {showPreview ? `✕ ${t('tsPreview')}` : `👁 ${t('tsPreview')}`}
                </button>
                <a href={previewSrc.replace('?preview=true', '')} target="_blank" rel="noreferrer" className={styles.mobilePreviewLink}>
                  👁 {t('rleViewSite')}
                </a>
              </>
            )}
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
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
                        <div className={styles.blockHeader} onClick={() => toggleCollapse(block.type)} style={{ cursor: 'pointer' }}>
                          <span className={styles.dragHandle} {...dragHandleProps} title={t('rleDragReorder')} onClick={e => e.stopPropagation()}>⠿</span>
                          <span className={styles.blockIcon}>{def.icon}</span>
                          <div className={styles.blockMeta}>
                            <div className={styles.blockLabel}>{t(def.labelKey)}</div>
                            <div className={styles.blockDesc}>{t(def.descKey)}</div>
                          </div>
                          <div className={styles.blockActions}>
                            <button className={`${styles.toggleBtn} ${block.enabled ? styles.toggleBtnOn : ''}`} onClick={e => { e.stopPropagation(); toggleBlock(block.type) }}>
                              {block.enabled ? t('rleActive') : t('rleDisabled')}
                            </button>
                            <button className={styles.collapseBtn} onClick={e => { e.stopPropagation(); toggleCollapse(block.type) }}>
                              <span className={`${styles.chevron} ${!collapsed.has(block.type) ? styles.chevronOpen : ''}`}>›</span>
                            </button>
                          </div>
                        </div>
                        {block.enabled && !collapsed.has(block.type) && (
                          <div className={styles.blockBody}>
                            {def.hasLayout && <BlockLayoutPicker blockType={block.type} value={block.data.layout} onChange={v => updateField(block.type, 'layout', v)} />}
                            {def.hasColSplit && block.data.layout !== 'text-only' && <ColSplitPicker value={block.data.col_split || '50-50'} onChange={v => updateField(block.type, 'col_split', v)} />}
                            {def.auto ? (
                              <p className={styles.autoNote}>ℹ️ {t('rleAutoNote')}</p>
                            ) : (
                              def.fields.map(field => (
                                <div key={field.key} className={styles.formRow}>
                                  {field.labelKey && <label className={styles.label}>{t(field.labelKey)}</label>}
                                  <BlockFieldRenderer field={field} value={block.data[field.key]} onChange={val => updateField(block.type, field.key, val)} restaurantId={restaurant?.id} />
                                  {field.hintKey && <p className={styles.fieldHint}>{t(field.hintKey)}</p>}
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
          <h2 className={styles.seoHeading}>{t('rleSeoSection')}</h2>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('rleSeoTitleLabel')}</label>
            <input type="text" className={styles.input} value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={t('htSeoTitlePh', { name: restaurant?.name || 'Najam' })} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('rleSeoDescLabel')}</label>
            <textarea className={styles.textarea} value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder={t('htSeoDescPh')} rows={3} />
          </div>
        </div>

        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('rleSaveAll')}</button>
        </div>
      </div>

      {showPreview && previewSrc && (
        <>
          <div className={styles.panelDivider} onMouseDown={onDividerMouseDown} />
          <LandingPreview src={previewSrc} blocks={blocks} onClose={() => setShowPreview(false)} />
        </>
      )}
    </div>
  )
}
