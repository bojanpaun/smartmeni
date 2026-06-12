import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

const CATEGORIES = ['drink', 'alcohol', 'snack']
const CAT_KEYS = { drink: 'saMinDrink', alcohol: 'saMinAlcohol', snack: 'saMinSnack' }

const BLANK = { id: '', name: '', name_en: '', category: 'drink', suggested_price: '', sort_order: 0, is_active: true }

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/[čć]/g, 'c').replace(/[šđ]/g, 's').replace(/ž/g, 'z')
  .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)

export default function MinibarLibraryAdmin() {
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
    const { data } = await supabase.from('minibar_library').select('*').order('sort_order').order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => { setEditing(it.id); setForm({ ...BLANK, ...it, suggested_price: it.suggested_price ?? '' }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const handleSave = async () => {
    if (!form.name.trim()) return flash(t('saNameReqShort'))
    const id = editing || slugify(form.id || form.name)
    if (!id) return flash(t('saIdNameReq'))
    setSaving(true)
    const payload = {
      id, name: form.name.trim(), name_en: form.name_en?.trim() || null,
      category: form.category,
      suggested_price: form.suggested_price === '' ? null : Number(form.suggested_price),
      sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active,
    }
    const { error } = await supabase.from('minibar_library').upsert(payload, { onConflict: 'id' })
    setSaving(false)
    if (error) return flash(t('saErrPrefix') + error.message)
    close(); flash(t('saSaved')); load()
  }

  const remove = async (id) => {
    if (!window.confirm(t('saMinDeleteConfirm'))) return
    await supabase.from('minibar_library').delete().eq('id', id)
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
          <h1 className={styles.title} style={{ fontSize: '1.3rem' }}>{t('saMinTitle')}</h1>
          <p className={styles.subtitle}>{t('saMinSub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ alignSelf: 'center', color: 'var(--c-primary)', fontSize: 13 }}>✓ {msg}</span>}
          <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← {t('saBackSuper')}</button>
          <button className={styles.btnPrimary} onClick={openNew}>+ {t('saNewItem')}</button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {!editing && (
              <div style={{ width: 140 }}>
                <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('saIdSlug')}</label>
                <input className={styles.input} value={form.id} onChange={e => upd('id', e.target.value)} placeholder="auto" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('saNameME')}</label>
              <input className={styles.input} value={form.name} onChange={e => upd('name', e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('saNameEN')}</label>
              <input className={styles.input} value={form.name_en} onChange={e => upd('name_en', e.target.value)} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('spaCategory')}</label>
              <select className={styles.input} value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('saPriceEur')}</label>
              <input className={styles.input} type="number" min="0" step="0.01" value={form.suggested_price} onChange={e => upd('suggested_price', e.target.value)} />
            </div>
            <div style={{ width: 90 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('saSortOrder')}</label>
              <input className={styles.input} type="number" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span style={{ fontSize: 13 }}>{t('spaActiveM')}</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>{t('saColItem')}</th>
              <th style={{ padding: '10px 12px' }}>{t('spaCategory')}</th>
              <th style={{ padding: '10px 12px' }}>{t('spaPrice')}</th>
              <th style={{ padding: '10px 12px' }}>{t('spaActiveM')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.name}<span style={{ marginLeft: 8, fontSize: 11, color: 'var(--c-text-muted)' }}>{it.id}</span></td>
                <td style={{ padding: '10px 12px' }}>{catLabel(it.category)}</td>
                <td style={{ padding: '10px 12px' }}>{it.suggested_price != null ? `€${Number(it.suggested_price).toFixed(2)}` : '—'}</td>
                <td style={{ padding: '10px 12px' }}>{it.is_active ? '✓' : '—'}</td>
                <td style={{ padding: '10px 12px' }}>
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
