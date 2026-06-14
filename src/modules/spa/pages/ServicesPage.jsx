import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useSpaServices } from '../hooks/useSpaServices'
import { translateContent } from '../../../lib/contentTranslate'
import { useLibraryTranslations } from '../../../lib/useLibraryTranslations'
import { useMoney } from '../../../lib/useMoney'
import ContentTranslations from '../../../components/shared/ContentTranslations'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const CATEGORIES = [
  { value: 'massage',  key: 'spaCatMassage',  icon: '💆' },
  { value: 'facial',   key: 'spaCatFacial',   icon: '✨' },
  { value: 'body',     key: 'spaCatBody',     icon: '🧖' },
  { value: 'nail',     key: 'spaCatNail',     icon: '💅' },
  { value: 'wellness', key: 'spaCatWellness', icon: '🌿' },
  { value: 'group',    key: 'spaCatGroup',    icon: '👥' },
]

const BLANK = {
  name: '', category: 'massage', description: '', duration_minutes: 60,
  buffer_minutes: 15, price: '', price_couple: '', max_guests: 1,
  image_url: '', is_active: true, requires_consultation: false, display_order: 0,
}

export default function ServicesPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const money = useMoney()
  const lt = useLibraryTranslations()
  const { services, loading, save, remove, toggle, refetch } = useSpaServices(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)
  const [catFilter, setCatFilter] = useState('all')
  const [transSvc, setTransSvc] = useState(null) // usluga čiji editor prevoda je otvoren

  // Biblioteka tretmana (uvoz)
  const [showLib, setShowLib]   = useState(false)
  const [libItems, setLibItems] = useState([])
  const [libLoading, setLibLoading] = useState(false)
  const [importingId, setImportingId] = useState(null)
  const [libMsg, setLibMsg] = useState('')

  if (!restaurant) return <LoadingSpinner fullPage />

  const openLib = async () => {
    setShowLib(true); setLibMsg(''); setLibLoading(true)
    const { data } = await supabase
      .from('spa_treatment_library')
      .select('id, name, name_en, category, duration_minutes, suggested_price')
      .eq('is_active', true)
      .order('sort_order').order('name')
    setLibItems(data ?? [])
    setLibLoading(false)
  }

  const importTreatment = async (id, name) => {
    setImportingId(id)
    const { data, error } = await supabase.rpc('import_spa_treatment', {
      p_restaurant_id: restaurant.id, p_treatment_id: id,
    })
    setImportingId(null)
    if (error) { setLibMsg(t('spaImportErr') + error.message); return }
    setLibMsg(data?.skipped ? t('spaAlreadyExists', { name }) : t('spaImported', { name }))
    refetch()
  }

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (s) => { setEditing(s.id); setForm({ ...BLANK, ...s }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null); setForm(BLANK) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const saved = await save({ ...form, price: Number(form.price), price_couple: form.price_couple ? Number(form.price_couple) : null }, editing)
    // AI prevod naziva/opisa usluge na ostale jezike (fire-and-forget).
    if (saved?.id) {
      const items = []
      if (saved.name?.trim()) items.push({ entity_type: 'spa_service', entity_id: saved.id, field: 'name', text: saved.name })
      if (saved.description?.trim()) items.push({ entity_type: 'spa_service', entity_id: saved.id, field: 'description', text: saved.description })
      translateContent(restaurant.id, items).catch(() => {})
    }
    setSaving(false)
    close()
  }

  const filtered = catFilter === 'all' ? services : services.filter(s => s.category === catFilter)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaSvcTitle')}</h1>
          <p className={styles.subtitle}>{t('spaSvcSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={openLib} title={t('libBtnHint')}>📚 {t('spaFromLibrary')}</button>
          <button className={styles.btnPrimary} onClick={openNew}>+ {t('spaNewTreatment')}</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 14, lineHeight: 1.4 }}>📚 {t('libBtnHint')}</div>

      {showLib && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{t('spaLibTitle')}</span>
            <button className={spa.formPanelClose} onClick={() => setShowLib(false)}>✕</button>
          </div>
          <div style={{ padding: '4px 4px 12px', fontSize: 13, color: 'var(--c-text-muted)' }}>
            {t('spaLibDesc')} {libMsg && <strong style={{ color: '#0d7a52' }}>· {libMsg}</strong>}
          </div>
          {libLoading ? <LoadingSpinner /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {libItems.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{lt('spa_treatment_library', it.id, 'name', it.name)}</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                      {it.duration_minutes} {t('spaMinUnit')}{it.suggested_price != null ? ` · ~${money(it.suggested_price)}` : ''}
                    </div>
                  </div>
                  <button className={styles.btnSecondary} style={{ fontSize: 12 }} disabled={importingId === it.id} onClick={() => importTreatment(it.id, it.name)}>
                    {importingId === it.id ? '...' : `+ ${t('spaImport')}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`${styles.filterBtn} ${catFilter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setCatFilter('all')}
        >
          {t('spaAll')} ({services.length})
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`${styles.filterBtn} ${catFilter === c.value ? styles.filterBtnActive : ''}`}
            onClick={() => setCatFilter(c.value)}
          >
            {c.icon} {t(c.key)} ({services.filter(s => s.category === c.value).length})
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? t('spaEditTreatment') : t('spaNewTreatment')}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaTreatmentNameReq')}</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} placeholder={t('spaTreatmentNamePh')} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaCategory')}</label>
              <select className={spa.formSelect} value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {t(c.key)}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaPriceReq')}</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} placeholder="80.00" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaDuration')}</label>
              <select className={spa.formSelect} value={form.duration_minutes} onChange={e => upd('duration_minutes', Number(e.target.value))}>
                {[30,45,60,75,90,105,120,150,180].map(v => <option key={v} value={v}>{v} {t('spaMinUnit')}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaBuffer')}</label>
              <select className={spa.formSelect} value={form.buffer_minutes} onChange={e => upd('buffer_minutes', Number(e.target.value))}>
                {[0,10,15,20,30].map(v => <option key={v} value={v}>{v} {t('spaMinUnit')}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaPriceCouple')}</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price_couple || ''} onChange={e => upd('price_couple', e.target.value)} placeholder="150.00" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaMaxGuests')}</label>
              <input className={spa.formInput} type="number" min="1" max="20" value={form.max_guests} onChange={e => upd('max_guests', Number(e.target.value))} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaDescLabel')}</label>
              <textarea className={spa.formTextarea} value={form.description || ''} onChange={e => upd('description', e.target.value)} placeholder={t('spaRoomDescPh')} rows={3} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaImageUrlOptional')}</label>
              <input className={spa.formInput} type="url" value={form.image_url || ''} onChange={e => upd('image_url', e.target.value)} placeholder="https://..." />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaDisplayOrder')}</label>
              <input className={spa.formInput} type="number" min="0" value={form.display_order} onChange={e => upd('display_order', Number(e.target.value))} />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
              <label className={spa.toggle}>
                <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
                <span className={spa.toggleSlider} />
              </label>
              <span className={spa.formLabel} style={{ margin: 0 }}>{t('spaTreatmentActive')}</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editing ? t('spaSaveChanges') : t('spaCreateTreatment')}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>💆</div>
          <p>{catFilter === 'all' ? t('spaNoTreatments') : t('spaNoTreatmentsCat')}</p>
        </div>
      ) : (
        <>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>{t('amTransPageHint')}</div>
        <div className={spa.cardGrid}>
          {filtered.map(s => {
            const cat = CATEGORIES.find(c => c.value === s.category) || CATEGORIES[0]
            return (
              <div key={s.id} className={spa.card} style={{ opacity: s.is_active ? 1 : 0.65 }}>
                {s.image_url
                  ? <img src={s.image_url} alt={s.name} className={spa.cardImg} />
                  : <div className={spa.cardImgPlaceholder}>{cat.icon}</div>
                }
                <div className={spa.cardBody}>
                  <div className={spa.cardTitle}>{s.name}</div>
                  <div className={spa.cardMeta}>
                    <span>{cat.icon} {t(cat.key)}</span>
                    <span>⏱ {s.duration_minutes} {t('spaMinUnit')}</span>
                    {s.price_couple && <span>👫 {money(s.price_couple)}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={spa.cardPrice}>{money(s.price)}</span>
                    <span className={`${spa.badge} ${s.is_active ? spa.badgeActive : spa.badgeInactive}`}>
                      {s.is_active ? t('spaActiveM') : t('spaInactiveM')}
                    </span>
                  </div>
                  {s.description && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8, lineHeight: 1.4 }}>{s.description}</p>}
                  <div className={spa.cardActions}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(s)}>{t('htEdit')}</button>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => setTransSvc(s)} title={t('amTransTitle')}>🌐 {t('amTransShort')}</button>
                    <button
                      className={styles.btnSecondary}
                      style={{ fontSize: 12 }}
                      onClick={() => toggle(s.id, !s.is_active)}
                    >
                      {s.is_active ? t('spaDeactivate') : t('spaActivate')}
                    </button>
                    <button
                      style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => { if (window.confirm(t('spaDeleteTreatmentConfirm'))) remove(s.id) }}
                    >
                      {t('htDelete')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      {transSvc && (
        <ContentTranslations
          restaurantId={restaurant.id} entityType="spa_service" entityId={transSvc.id}
          headerTitle={transSvc.name}
          sourceName={transSvc.name} sourceDescription={transSvc.description}
          onClose={() => setTransSvc(null)}
        />
      )}
    </div>
  )
}
