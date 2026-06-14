import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import spa from '../../modules/spa/pages/Spa.module.css'

const CATEGORIES = ['massage', 'facial', 'body', 'nail', 'wellness', 'group']
const CAT_KEYS = { massage: 'spaCatMassage', facial: 'spaCatFacial', body: 'spaCatBody', nail: 'spaCatNail', wellness: 'spaCatWellness', group: 'spaCatGroup' }

// Nazivi/opisi se prevode AI-jem (library_translations za biblioteku; content_translations
// za uvezene usluge — okida importTreatment). Stare _en kolone se više ne uređuju ovdje
// (ostaju u bazi kao fallback).
const BLANK = {
  id: '', name: '', category: 'massage', description: '',
  duration_minutes: 60, buffer_minutes: 15, suggested_price: '', price_couple: '',
  requires_consultation: false, image_url: '', sort_order: 0, is_active: true,
}

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/[čć]/g, 'c').replace(/[šđ]/g, 's').replace(/ž/g, 'z')
  .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)

export default function SpaTreatmentLibraryAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const catLabel = (c) => CAT_KEYS[c] ? t(CAT_KEYS[c]) : c
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('spa_treatment_library')
      .select('*')
      .order('sort_order').order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => {
    setEditing(it.id)
    setForm({ ...BLANK, ...it, suggested_price: it.suggested_price ?? '', price_couple: it.price_couple ?? '' })
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const handleSave = async () => {
    if (!form.name.trim()) return flash(t('saNameReq'))
    const id = editing || slugify(form.id || form.name)
    if (!id) return flash(t('saIdNameReq'))
    setSaving(true)
    const payload = {
      id,
      name: form.name.trim(),
      category: form.category, description: form.description || null,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      buffer_minutes: parseInt(form.buffer_minutes) || 0,
      suggested_price: form.suggested_price === '' ? null : Number(form.suggested_price),
      price_couple: form.price_couple === '' ? null : Number(form.price_couple),
      requires_consultation: form.requires_consultation,
      image_url: form.image_url?.trim() || null,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    }
    const { error } = await supabase.from('spa_treatment_library').upsert(payload, { onConflict: 'id' })
    setSaving(false)
    if (error) return flash(t('saErrPrefix') + error.message)
    close(); flash(t('saSaved')); load()
  }

  const remove = async (id) => {
    if (!window.confirm(t('saSpaDeleteConfirm'))) return
    await supabase.from('spa_treatment_library').delete().eq('id', id)
    load()
  }

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>{t('saNoAccess')}</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '1.3rem' }}>{t('saSpaTitle')}</h1>
          <p className={styles.subtitle}>{t('saSpaSub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ alignSelf: 'center', color: 'var(--c-primary)', fontSize: 13 }}>✓ {msg}</span>}
          <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← {t('saBackSuper')}</button>
          <button className={styles.btnPrimary} onClick={openNew}>+ {t('saNewTreatment')}</button>
        </div>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? t('saEditName', { name: form.name }) : t('saNewTreatment')}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            {!editing && (
              <div className={spa.formField}>
                <label className={spa.formLabel}>{t('saIdSlugAuto')}</label>
                <input className={spa.formInput} value={form.id} onChange={e => upd('id', e.target.value)} placeholder="auto" />
              </div>
            )}
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('saNameME')}</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaCategory')}</label>
              <select className={spa.formSelect} value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('spaDuration')}</label>
              <input className={spa.formInput} type="number" min="0" value={form.duration_minutes} onChange={e => upd('duration_minutes', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('saBufferMin')}</label>
              <input className={spa.formInput} type="number" min="0" value={form.buffer_minutes} onChange={e => upd('buffer_minutes', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('saSuggestedPrice')}</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.suggested_price} onChange={e => upd('suggested_price', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('saPriceCouple2')}</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price_couple} onChange={e => upd('price_couple', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>{t('saSortOrder')}</label>
              <input className={spa.formInput} type="number" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('saDescME')}</label>
              <textarea className={spa.formTextarea} rows={2} value={form.description} onChange={e => upd('description', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>{t('saImageUrl')}</label>
              <input className={spa.formInput} value={form.image_url} onChange={e => upd('image_url', e.target.value)} placeholder={t('saImageUrlPh')} />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.requires_consultation} onChange={e => upd('requires_consultation', e.target.checked)} />
              <span className={spa.formLabel} style={{ margin: 0 }}>{t('saRequiresConsult')}</span>
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span className={spa.formLabel} style={{ margin: 0 }}>{t('saActiveVisible')}</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <table className={spa.table} style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr><th>{t('saColTreatment')}</th><th>{t('spaCategory')}</th><th>{t('saColDuration')}</th><th>{t('spaPrice')}</th><th>{t('spaActiveM')}</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ fontWeight: 600 }}>{it.name}<span style={{ marginLeft: 8, fontSize: 11, color: 'var(--c-text-muted)' }}>{it.id}</span></td>
                <td>{catLabel(it.category)}</td>
                <td>{it.duration_minutes} {t('spaMinUnit')}</td>
                <td>{it.suggested_price != null ? `€${Number(it.suggested_price).toFixed(2)}` : '—'}</td>
                <td>{it.is_active ? '✓' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(it)}>{t('htEdit')}</button>
                    <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(it.id)}>{t('htDelete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
