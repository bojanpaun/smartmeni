import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

const BLANK = { title: '', description: '', sort_order: 0, is_active: true }

// Superadmin CRUD roadmap najava („Šta razvijamo"). Stavke se prikazuju svim
// korisnicima diskretno (RoadmapTicker). Bez dismiss/read/expire.
export default function RoadmapManager() {
  const { t } = useTranslation('admin')
  const { user } = usePlatform()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [masterOn, setMasterOn] = useState(true) // platform_settings.roadmap_dashboard_enabled

  const load = async () => {
    setLoading(true)
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('platform_roadmap').select('*').order('sort_order'),
      supabase.from('platform_settings').select('roadmap_dashboard_enabled').limit(1).maybeSingle(),
    ])
    setItems(data ?? [])
    setMasterOn(settings?.roadmap_dashboard_enabled ?? true)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Master prekidač: gasi/pali cijeli ticker na dashboardu odjednom. Ne dira
  // is_active po stavci — kad se vrati na ON, vidljivost se obnavlja kakva je bila.
  const toggleMaster = async () => {
    const next = !masterOn
    setMasterOn(next)
    const { error } = await supabase.from('platform_settings')
      .update({ roadmap_dashboard_enabled: next, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq('id', true)
    if (error) setMasterOn(!next) // rollback na grešku
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const reset = () => { setForm(BLANK); setEditingId(null); setShowForm(false) }
  const openEdit = (a) => { setEditingId(a.id); setForm({ title: a.title, description: a.description || '', sort_order: a.sort_order ?? 0, is_active: a.is_active }); setShowForm(true) }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    }
    if (editingId) await supabase.from('platform_roadmap').update(payload).eq('id', editingId)
    else await supabase.from('platform_roadmap').insert(payload)
    setSaving(false); reset(); load()
  }

  const toggleActive = async (a) => {
    await supabase.from('platform_roadmap').update({ is_active: !a.is_active }).eq('id', a.id)
    setItems(items.map(i => i.id === a.id ? { ...i, is_active: !i.is_active } : i))
  }

  const remove = async (id) => {
    if (!window.confirm(t('rmDeleteConfirm'))) return
    await supabase.from('platform_roadmap').delete().eq('id', id)
    load()
  }

  return (
    <div>
      {/* Master prekidač — gasi/pali cijeli ticker na dashboardu odjednom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>📡 {t('rmMasterLabel')}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>{t('rmMasterHint')}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={masterOn}
          aria-label={t('rmMasterLabel')}
          onClick={toggleMaster}
          style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', padding: 3, background: masterOn ? 'var(--c-primary)' : 'var(--c-border)', transition: 'background 0.15s', display: 'flex', justifyContent: masterOn ? 'flex-end' : 'flex-start' }}
        >
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{t('rmManageSub')}</div>
        {!showForm && <button className={styles.btnPrimary} onClick={() => { setForm(BLANK); setEditingId(null); setShowForm(true) }}>+ {t('rmNewItem')}</button>}
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{editingId ? `✏️ ${t('htEdit')}` : t('rmNewItem')}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saTitleLabel')}</label>
            <input className={styles.input} style={{ width: '100%' }} value={form.title} onChange={e => upd('title', e.target.value)} placeholder={t('saTitlePh')} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saText')}</label>
            <textarea className={styles.input} style={{ width: '100%', minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => upd('description', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('rmOrderLabel')}</label>
              <input className={styles.input} type="number" style={{ width: 90 }} value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span style={{ fontSize: 13 }}>{t('rmActiveLabel')}</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className={styles.btnSecondary} onClick={reset}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? t('saving') : (editingId ? t('spaSaveChanges') : t('npPublish'))}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('rmEmpty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(a => (
            <div key={a.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', opacity: a.is_active ? 1 : 0.55, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>🚀 {a.title}{!a.is_active && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}> · {t('rmActiveLabel')}: ✕</span>}</div>
                {a.description && <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>{t('rmOrderLabel')}: {a.sort_order}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => toggleActive(a)}>{a.is_active ? '🙈' : '👁️'}</button>
                <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(a)}>{t('htEdit')}</button>
                <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(a.id)}>{t('htDelete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
