import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useMoney } from '../../../lib/useMoney'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

// Packages use a simplified includes format:
// [{type:'text', description:'...'}, ...]

const BLANK = {
  name: '', description: '', total_price: '',
  valid_from: '', valid_to: '', is_active: true, includes: [],
}

function useSpaPackages(restaurantId, t) {
  const [packages, setPackages] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_packages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
    setPackages(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const save = async (values, id = null) => {
    const payload = { ...values, restaurant_id: restaurantId }
    const { error } = id
      ? await supabase.from('spa_packages').update(payload).eq('id', id)
      : await supabase.from('spa_packages').insert(payload)
    if (error) { toast.error(t('spaPkgSaveErr')); return false }
    toast.success(id ? t('spaPkgUpdated') : t('spaPkgCreated'))
    load(); return true
  }

  const remove = async (id) => {
    const { error } = await supabase.from('spa_packages').delete().eq('id', id)
    if (error) { toast.error(t('spaPkgDeleteErr')); return false }
    toast.success(t('spaPkgDeleted')); load(); return true
  }

  const toggle = async (id, is_active) => {
    await supabase.from('spa_packages').update({ is_active }).eq('id', id)
    setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active } : p))
  }

  return { packages, loading, refetch: load, save, remove, toggle }
}

export default function PackagesPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const money = useMoney()
  const { packages, loading, save, remove, toggle } = useSpaPackages(restaurant?.id, t)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [newItem, setNewItem]   = useState('')
  const [saving, setSaving]     = useState(false)

  if (!restaurant) return <LoadingSpinner fullPage />

  const openNew  = () => { setEditing(null); setForm(BLANK); setNewItem(''); setShowForm(true) }
  const openEdit = (p) => {
    setEditing(p.id)
    setForm({
      name: p.name, description: p.description || '',
      total_price: p.total_price || '',
      valid_from: p.valid_from || '', valid_to: p.valid_to || '',
      is_active: p.is_active,
      includes: Array.isArray(p.includes) ? p.includes : [],
    })
    setNewItem('')
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => {
    if (!newItem.trim()) return
    setForm(f => ({ ...f, includes: [...f.includes, { type: 'text', description: newItem.trim() }] }))
    setNewItem('')
  }
  const removeItem = (i) => setForm(f => ({ ...f, includes: f.includes.filter((_, idx) => idx !== i) }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.total_price) return
    setSaving(true)
    await save({
      ...form,
      total_price: Number(form.total_price),
      valid_from: form.valid_from || null,
      valid_to:   form.valid_to   || null,
    }, editing)
    setSaving(false)
    close()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaPkgTitle')}</h1>
          <p className={styles.subtitle}>{t('spaPkgSubtitle')}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ {t('spaNewPackage')}</button>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? t('spaEditPackage') : t('spaNewPackage')}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaPkgNameReq')}</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} placeholder={t('spaPkgNamePh')} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaTotalPriceReq')}</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.total_price} onChange={e => upd('total_price', e.target.value)} placeholder="350.00" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>&nbsp;</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}>
                <label className={spa.toggle}>
                  <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
                  <span className={spa.toggleSlider} />
                </label>
                <span className={spa.formLabel} style={{ margin: 0 }}>{t('spaActiveM')}</span>
              </div>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaValidFrom')}</label>
              <input className={spa.formInput} type="date" value={form.valid_from} onChange={e => upd('valid_from', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaValidTo')}</label>
              <input className={spa.formInput} type="date" value={form.valid_to} onChange={e => upd('valid_to', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaDescOptional')}</label>
              <textarea className={spa.formTextarea} value={form.description} onChange={e => upd('description', e.target.value)} rows={2} placeholder={t('spaRoomDescPh')} />
            </div>

            {/* Package items */}
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('spaWhatIncludes')}</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  className={spa.formInput}
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  placeholder={t('spaIncludePh')}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
                  style={{ flex: 1 }}
                />
                <button type="button" className={styles.btnSecondary} style={{ whiteSpace: 'nowrap', padding: '8px 14px' }} onClick={addItem}>+ {t('spaAddShort')}</button>
              </div>
              {form.includes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.includes.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--c-bg)', padding: '8px 12px', borderRadius: 8 }}>
                      <span style={{ flex: 1, fontSize: 13 }}>✓ {item.description}</span>
                      <button type="button" onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {form.includes.length === 0 && <p style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{t('spaAddItemsHint')}</p>}
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editing ? t('spaSaveChanges') : t('spaCreatePackage')}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : packages.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>🎁</div>
          <p>{t('spaNoPackages')}</p>
        </div>
      ) : (
        <div className={spa.cardGrid}>
          {packages.map(pkg => {
            const includes = Array.isArray(pkg.includes) ? pkg.includes : []
            return (
              <div key={pkg.id} className={spa.card} style={{ opacity: pkg.is_active ? 1 : 0.65 }}>
                <div className={spa.cardImgPlaceholder} style={{ height: 90, fontSize: 36 }}>🎁</div>
                <div className={spa.cardBody}>
                  <div className={spa.cardTitle}>{pkg.name}</div>
                  <div className={spa.cardMeta}>
                    {pkg.valid_from && pkg.valid_to && (
                      <span>📅 {pkg.valid_from} – {pkg.valid_to}</span>
                    )}
                    <span className={`${spa.badge} ${pkg.is_active ? spa.badgeActive : spa.badgeInactive}`}>
                      {pkg.is_active ? t('spaActiveM') : t('spaInactiveM')}
                    </span>
                  </div>
                  {pkg.description && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>{pkg.description}</p>}
                  {includes.length > 0 && (
                    <ul style={{ margin: '0 0 10px', paddingLeft: 16, fontSize: 12, color: 'var(--c-text-medium)', lineHeight: 1.8 }}>
                      {includes.slice(0, 4).map((item, i) => <li key={i}>{item.description}</li>)}
                      {includes.length > 4 && <li style={{ color: 'var(--c-text-muted)' }}>+{includes.length - 4} {t('spaItemsWord')}</li>}
                    </ul>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className={spa.cardPrice}>{money(pkg.total_price || 0)}</span>
                  </div>
                  <div className={spa.cardActions}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(pkg)}>{t('htEdit')}</button>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => toggle(pkg.id, !pkg.is_active)}>
                      {pkg.is_active ? t('spaDeactivate') : t('spaActivate')}
                    </button>
                    <button
                      style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => { if (window.confirm(t('spaDeletePackageConfirm'))) remove(pkg.id) }}
                    >{t('htDelete')}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
