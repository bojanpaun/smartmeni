import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

// Kreiranje/uređivanje platform najava (samo sadržaj — bez page header-a).
// Koristi se u NotificationsPage (superadmin „Najave platforme") i AnnouncementsAdmin.

const SEVERITY = [
  { key: 'info',      labelKey: 'saSevInfo' },
  { key: 'update',    labelKey: 'saSevUpdate' },
  { key: 'important', labelKey: 'saSevImportant' },
]
const AUDIENCE = [
  { key: 'all',        labelKey: 'saAudAll' },
  { key: 'restaurant', labelKey: 'saAudRestaurant' },
  { key: 'hotel',      labelKey: 'saAudHotel' },
]
const SEV_LABEL = { info: 'saSevInfo', update: 'saSevUpdate', important: 'saSevImportantShort' }
const AUD_LABEL = { all: 'saAudAllShort', restaurant: 'saAudRestShort', hotel: 'saAudHotelShort' }
const BLANK = { title: '', body: '', severity: 'info', audience: 'all', expires_at: '' }

export default function AnnouncementsManager() {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('platform_announcements').select('*').order('published_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const openEdit = (a) => {
    setEditingId(a.id)
    setForm({ title: a.title, body: a.body || '', severity: a.severity, audience: a.audience, expires_at: a.expires_at ? a.expires_at.slice(0, 10) : '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelEdit = () => { setEditingId(null); setForm(BLANK) }

  const publish = async () => {
    if (!form.title.trim()) return flash(t('saTitleReq'))
    setSaving(true)
    const payload = {
      title: form.title.trim(), body: form.body.trim() || null,
      severity: form.severity, audience: form.audience,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    }
    let error
    if (editingId) {
      ;({ error } = await supabase.from('platform_announcements').update({ ...payload, edited_at: new Date().toISOString() }).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('platform_announcements').insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id ?? null }))
    }
    setSaving(false)
    if (error) return flash(t('saErrPrefix') + error.message)
    setForm(BLANK); setEditingId(null)
    flash(editingId ? t('saAnnEdited') : t('saAnnPublished'))
    load()
  }

  const remove = async (id) => {
    if (!window.confirm(t('saAnnDeleteConfirm'))) return
    await supabase.from('platform_announcements').delete().eq('id', id)
    load()
  }

  return (
    <div>
      {msg && <div style={{ color: 'var(--c-primary)', fontSize: 13, marginBottom: 10 }}>✓ {msg}</div>}

      {/* Compose */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{editingId ? `✏️ ${t('saAnnEditTitle')}` : t('saAnnNew')}</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saTitleLabel')}</label>
          <input className={styles.input} style={{ width: '100%' }} value={form.title} onChange={e => upd('title', e.target.value)} placeholder={t('saTitlePh')} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saText')}</label>
          <textarea className={styles.input} style={{ width: '100%', minHeight: 90, resize: 'vertical' }} value={form.body} onChange={e => upd('body', e.target.value)} placeholder={t('saTextPh')} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saImportance')}</label>
            <select className={styles.input} value={form.severity} onChange={e => upd('severity', e.target.value)}>
              {SEVERITY.map(s => <option key={s.key} value={s.key}>{t(s.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saAudience')}</label>
            <select className={styles.input} value={form.audience} onChange={e => upd('audience', e.target.value)}>
              {AUDIENCE.map(a => <option key={a.key} value={a.key}>{t(a.labelKey)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>{t('saExpires')}</label>
            <input className={styles.input} type="date" value={form.expires_at} onChange={e => upd('expires_at', e.target.value)} />
          </div>
          <button className={styles.btnPrimary} onClick={publish} disabled={saving}>{saving ? t('saving') : (editingId ? `💾 ${t('spaSaveChanges')}` : `📣 ${t('saPublishAnn')}`)}</button>
          {editingId && <button className={styles.btnSecondary} onClick={cancelEdit}>{t('cancel')}</button>}
        </div>
      </div>

      {/* Lista */}
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('saPublishedAnns')}</div>
      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('saNoAnns')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(a => {
            const expired = a.expires_at && new Date(a.expires_at) < new Date()
            return (
              <div key={a.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', opacity: expired ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {t(SEV_LABEL[a.severity]) || a.severity} · {a.title}
                      {expired && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--c-text-muted)' }}>{t('saExpired')}</span>}
                    </div>
                    {a.body && <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.body}</div>}
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>
                      {t(AUD_LABEL[a.audience])} · {new Date(a.published_at).toLocaleDateString(dl, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {a.edited_at && <span> · {t('saEditedSuffix')}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-text-medium)', border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => openEdit(a)}>{t('htEdit')}</button>
                    <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(a.id)}>{t('htDelete')}</button>
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
