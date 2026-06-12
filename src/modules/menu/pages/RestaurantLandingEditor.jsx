import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import BlockSortable from '../../../components/shared/BlockSortable'
import LandingPreview from '../../../components/shared/LandingPreview'
import BlockLayoutPicker, { ColSplitPicker } from '../../../components/shared/BlockLayoutPicker'
import BlockFieldRenderer from '../../../components/shared/BlockFieldRenderer'
import styles from '../../../components/shared/LandingEditor.module.css'

// labelKey/descKey/hintKey se rješavaju kroz t('admin:…') u renderu (Faza 2).
// placeholder-i ostaju kao ilustrativni MNE primjeri (sample sadržaj).
const BLOCK_DEFS = [
  {
    type: 'hero', labelKey: 'rleHero', icon: '🖼️', hasLayout: true,
    descKey: 'rleHeroD', defaultEnabled: true,
    fields: [
      { key: 'title',        labelKey: 'rleFTitle',    type: 'text',  placeholder: 'Npr. Restoran Ribar' },
      { key: 'subtitle',     labelKey: 'rleFSubtitle', type: 'text',  placeholder: 'Svježi morski specijaliteti od 1985.' },
      { key: 'bg_image_url', labelKey: 'rleFBgImage',  type: 'image' },
    ],
    defaultData: { title: '', subtitle: '', bg_image_url: '', layout: 'fullscreen' },
  },
  {
    type: 'story', labelKey: 'rleStory', icon: '📖', hasLayout: true, hasColSplit: true,
    descKey: 'rleStoryD', defaultEnabled: false,
    fields: [
      { key: 'text',      labelKey: 'rleFText',     type: 'textarea', placeholder: 'Napišite nešto o restoranu...' },
      { key: 'image_url', labelKey: 'rleFPhotoOpt', type: 'image' },
    ],
    defaultData: { text: '', image_url: '', layout: 'image-right', col_split: '50-50' },
  },
  {
    type: 'menu_preview', labelKey: 'rleMenuPreview', icon: '🍽️', hasLayout: true,
    descKey: 'rleMenuPreviewD', defaultEnabled: true,
    auto: true, fields: [], defaultData: { layout: 'grid' },
  },
  {
    type: 'specials', labelKey: 'rleSpecials', icon: '🌟', hasLayout: true,
    descKey: 'rleSpecialsD', defaultEnabled: false,
    fields: [{ key: 'specials', labelKey: 'rleSpecials', type: 'specials-list' }],
    defaultData: { specials: [], layout: 'cards' },
  },
  {
    type: 'gallery', labelKey: 'rleGallery', icon: '🖼️', hasLayout: true,
    descKey: 'rleGalleryD', defaultEnabled: false,
    fields: [{ key: 'image_urls', labelKey: 'rleFPhotos', type: 'image-gallery' }],
    defaultData: { image_urls: '', layout: 'grid-3' },
  },
  {
    type: 'reviews', labelKey: 'rleReviews', icon: '⭐', hasLayout: true,
    descKey: 'rleReviewsD', defaultEnabled: false,
    fields: [{ key: 'reviews', labelKey: 'rleReviews', type: 'reviews-list' }],
    defaultData: { reviews: [], layout: 'cards' },
  },
  {
    type: 'video', labelKey: 'rleVideo', icon: '🎬', hasLayout: true,
    descKey: 'rleVideoD', defaultEnabled: false,
    fields: [
      { key: 'title',     labelKey: 'rleFTitleOpt', type: 'text',      placeholder: 'Pogledajte naš restoran' },
      { key: 'video_url', labelKey: 'rleFVideoUrl', type: 'video-url' },
    ],
    defaultData: { title: '', video_url: '', layout: 'full' },
  },
  {
    type: 'cta_banner', labelKey: 'rleCtaBanner', icon: '📢', hasLayout: true,
    descKey: 'rleCtaBannerD', defaultEnabled: false,
    fields: [
      { key: 'title',    labelKey: 'rleFTitle',    type: 'text', placeholder: 'Rezerviši večeras!' },
      { key: 'subtitle', labelKey: 'rleFDescOpt',  type: 'text', placeholder: 'Slobodna mjesta za večeras' },
      { key: 'btn_text', labelKey: 'rleFBtnText',  type: 'text', placeholder: 'Rezerviši sto' },
      { key: 'btn_link', labelKey: 'rleFBtnLink',  type: 'url',  placeholder: 'https://...' },
    ],
    defaultData: { title: '', subtitle: '', btn_text: '', btn_link: '', layout: 'centered' },
  },
  {
    type: 'hours_location', labelKey: 'rleHoursLoc', icon: '⏰', hasLayout: true,
    descKey: 'rleHoursLocD', defaultEnabled: false,
    fields: [
      { key: 'address',        labelKey: 'rleFAddress', type: 'text', placeholder: 'Mediteranska 12, 85310 Budva' },
      { key: 'hours',          labelKey: 'amHours',     type: 'text', placeholder: 'Pon–Ned 10:00–23:00' },
      { key: 'maps_embed_url', labelKey: 'rleFMapsUrl', type: 'url',  placeholder: 'https://www.google.com/maps/embed?pb=...', hintKey: 'rleMapsHint' },
    ],
    defaultData: { address: '', hours: '', maps_embed_url: '', layout: 'card-with-map' },
  },
  {
    type: 'reservation_cta', labelKey: 'rleReservation', icon: '📅', hasLayout: true,
    descKey: 'rleReservationD', defaultEnabled: true,
    fields: [
      { key: 'text',     labelKey: 'rleFCtaText',     type: 'text', placeholder: 'Rezerviši sto' },
      { key: 'subtitle', labelKey: 'rleFSubtitleOpt', type: 'text', placeholder: 'Slobodna mjesta za večeras' },
    ],
    defaultData: { text: 'Rezerviši sto', subtitle: '', layout: 'banner' },
  },
]

function initBlocks(restaurant) {
  return BLOCK_DEFS.map(def => {
    const data = { ...def.defaultData }
    if (def.type === 'hero') data.title = restaurant?.name || ''
    if (def.type === 'hours_location') data.address = restaurant?.address || ''
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

export default function RestaurantLandingEditor() {
  const { t } = useTranslation('admin')
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
        .eq('page_type', 'restaurant')
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
      page_type: 'restaurant',
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
    if (error) { console.error(error); toast.error(t('rleSaveErr')) }
    else toast.success(t('rleSaved'))
  }

  if (loading) return <div className={styles.loadWrap}>{t('loading')}</div>

  const previewSrc = restaurant ? `/${restaurant.slug}/home?preview=true` : null

  return (
    <div className={styles.editorShell}>
      {/* ── Form panel ── */}
      <div className={styles.formPanel} style={{ width: showPreview ? panelWidth : undefined, maxWidth: showPreview ? undefined : 760 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('navRestaurantSite')}</h1>
            <p className={styles.subtitle}>{t('rleSubtitle')}</p>
          </div>
          <div className={styles.headerActions}>
            {previewSrc && (
              <>
                <button
                  className={`${styles.previewToggleBtn} ${showPreview ? styles.previewToggleBtnOn : ''}`}
                  onClick={() => setShowPreview(v => !v)}
                >
                  {showPreview ? `✕ ${t('tsPreview')}` : `👁 ${t('tsPreview')}`}
                </button>
                <a
                  href={previewSrc.replace('?preview=true', '')}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.mobilePreviewLink}
                >
                  👁 {t('rleViewSite')}
                </a>
              </>
            )}
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
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
                          <span className={styles.dragHandle} {...dragHandleProps} title={t('rleDragReorder')} onClick={e => e.stopPropagation()}>⠿</span>
                          <span className={styles.blockIcon}>{def.icon}</span>
                          <div className={styles.blockMeta}>
                            <div className={styles.blockLabel}>{t(def.labelKey)}</div>
                            <div className={styles.blockDesc}>{t(def.descKey)}</div>
                          </div>
                          <div className={styles.blockActions}>
                            <button
                              className={`${styles.toggleBtn} ${block.enabled ? styles.toggleBtnOn : ''}`}
                              onClick={e => { e.stopPropagation(); toggleBlock(block.type) }}
                            >
                              {block.enabled ? t('rleActive') : t('rleDisabled')}
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
                            {def.hasColSplit && block.data.layout !== 'text-only' && block.data.layout !== 'image-above' && (
                              <ColSplitPicker
                                value={block.data.col_split || '50-50'}
                                onChange={v => updateField(block.type, 'col_split', v)}
                              />
                            )}
                            {def.auto ? (
                              <p className={styles.autoNote}>
                                ℹ️ {t('rleAutoNote')}
                              </p>
                            ) : (
                              def.fields.map(field => (
                                <div key={field.key} className={styles.formRow}>
                                  {field.labelKey && <label className={styles.label}>{t(field.labelKey)}</label>}
                                  <BlockFieldRenderer
                                    field={field}
                                    value={block.data[field.key]}
                                    onChange={val => updateField(block.type, field.key, val)}
                                    restaurantId={restaurant?.id}
                                  />
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
            <input type="text" className={styles.input} value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={t('rleSeoTitlePh', { name: restaurant?.name || 'Restoran' })} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.label}>{t('rleSeoDescLabel')}</label>
            <textarea className={styles.textarea} value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder={t('rleSeoDescPh')} rows={3} />
          </div>
        </div>

        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('rleSaveAll')}
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
