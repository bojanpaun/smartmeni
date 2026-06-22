import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import { translateContent, partnerAdFields } from '../../../lib/contentTranslate'
import styles from './PartnerAdsManager.module.css'

const PLACEMENTS = ['top', 'middle', 'bottom']

// Upravljanje reklamama partnera na javnom meniju. Interni alat restorana (bez addona).
// Banner se prikazuje na izabranoj poziciji (top/middle/bottom). title/subtitle se
// prevode AI-jem (Sloj B, entity_type='partner_ad').
export default function PartnerAdsManager({ restaurant }) {
  const { t } = useTranslation('admin')
  const { user } = usePlatform()
  const tr = useContentTranslations(restaurant?.id)

  const [ads, setAds] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  const emptyForm = {
    title: '', subtitle: '', image_url: '', link_url: '',
    placement: 'top', is_active: true, valid_from: '', valid_until: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (restaurant?.id) load(restaurant.id)
  }, [restaurant?.id])

  const load = async (rid) => {
    const { data } = await supabase.from('partner_ads').select('*').eq('restaurant_id', rid).order('sort_order')
    setAds(data || [])
  }

  const openNew = () => { setForm(emptyForm); setEditId(null); setErr(''); setShowForm(true) }
  const openEdit = (a) => {
    setForm({
      title: a.title || '', subtitle: a.subtitle || '', image_url: a.image_url || '', link_url: a.link_url || '',
      placement: a.placement || 'top', is_active: !!a.is_active,
      valid_from: a.valid_from || '', valid_until: a.valid_until || '',
    })
    setEditId(a.id); setErr(''); setShowForm(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/ad-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
      setForm(f => ({ ...f, image_url: data.publicUrl }))
    }
    setUploading(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.title.trim()) { setErr(t('paErrTitle')); return }
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      image_url: form.image_url || null,
      link_url: form.link_url.trim() || null,
      placement: form.placement,
      is_active: form.is_active,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    }
    let adId = editId
    if (editId) {
      await supabase.from('partner_ads').update(payload).eq('id', editId).eq('restaurant_id', restaurant.id)
    } else {
      const { data, error } = await supabase.from('partner_ads').insert(payload).select().single()
      if (error) { setErr(error.message); setSaving(false); return }
      adId = data.id
    }
    if (adId) {
      translateContent(restaurant.id, partnerAdFields({ id: adId, title: payload.title, subtitle: payload.subtitle })).catch(() => {})
    }
    setSaving(false); setShowForm(false)
    load(restaurant.id)
  }

  const remove = async (a) => {
    if (!confirm(t('paConfirmDelete', { name: a.title }))) return
    await supabase.from('partner_ads').delete().eq('id', a.id).eq('restaurant_id', restaurant.id)
    load(restaurant.id)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>📣 {t('paTitle')}</div>
          <div className={styles.subtitle}>{t('paSubtitle')}</div>
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ {t('paAdd')}</button>
      </div>

      {ads.length === 0 ? (
        <div className={styles.empty}>{t('paEmpty')}</div>
      ) : (
        <div className={styles.list}>
          {ads.map(a => (
            <div key={a.id} className={styles.row}>
              {a.image_url
                ? <img className={styles.thumb} src={a.image_url} alt={a.title} loading="lazy" />
                : <span className={styles.thumbEmpty}>📣</span>}
              <div className={styles.rowBody}>
                <div className={styles.rowName}>{tr('partner_ad', a.id, 'title', a.title)}</div>
                <div className={styles.rowMeta}>
                  <span className={styles.placeTag}>{t(`paPlace_${a.placement}`)}</span>
                  {!a.is_active && <> · <span className={styles.rowInactive}>{t('paInactive')}</span></>}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button className={styles.actionBtn} onClick={() => openEdit(a)}>{t('amEdit')}</button>
                <button className={styles.actionBtn} onClick={() => remove(a)}>{t('amDelete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{editId ? t('paEditTitle') : t('paNewTitle')}</div>
              <button className={styles.close} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className={styles.form} onSubmit={save}>
              <div className={styles.field}>
                <label>{t('paAdTitle')} * <span className={styles.hint}>{t('paTransNote')}</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label>{t('paAdSubtitle')}</label>
                <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t('paImage')}</label>
                {form.image_url && <img className={styles.preview} src={form.image_url} alt="preview" />}
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                {uploading && <span className={styles.hint}>{t('amUploadInProgress')}</span>}
              </div>
              <div className={styles.field}>
                <label>{t('paLink')} <span className={styles.hint}>{t('paLinkHint')}</span></label>
                <input type="url" placeholder="https://..." value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t('paPlacement')}</label>
                <select value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))}>
                  {PLACEMENTS.map(p => <option key={p} value={p}>{t(`paPlace_${p}`)}</option>)}
                </select>
              </div>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>{t('bmValidFrom')}</label>
                  <input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('bmValidUntil')}</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
                </div>
              </div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                {t('paActive')}
              </label>
              {err && <div className={styles.err}>{err}</div>}
              <div className={styles.actions}>
                <button type="button" className={styles.cancel} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.save} disabled={saving || uploading}>{saving ? t('saving') : t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
