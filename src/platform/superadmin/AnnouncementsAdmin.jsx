import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

const SEVERITY = [
  { key: 'info',      label: 'ℹ️ Info' },
  { key: 'update',    label: '✨ Novost' },
  { key: 'important', label: '⚠️ Važno (banner)' },
]
const AUDIENCE = [
  { key: 'all',        label: 'Svi tenanti' },
  { key: 'restaurant', label: 'Samo restorani' },
  { key: 'hotel',      label: 'Samo hoteli' },
]
const SEV_LABEL = { info: 'ℹ️ Info', update: '✨ Novost', important: '⚠️ Važno' }
const AUD_LABEL = { all: 'Svi', restaurant: 'Restorani', hotel: 'Hoteli' }

const BLANK = { title: '', body: '', severity: 'info', audience: 'all', expires_at: '' }

export default function AnnouncementsAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('platform_announcements')
      .select('*')
      .order('published_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const publish = async () => {
    if (!form.title.trim()) return flash('Naslov je obavezan')
    setSaving(true)
    const { error } = await supabase.from('platform_announcements').insert({
      title: form.title.trim(),
      body: form.body.trim() || null,
      severity: form.severity,
      audience: form.audience,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    setSaving(false)
    if (error) return flash('Greška: ' + error.message)
    setForm(BLANK)
    flash('Najava objavljena')
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati najavu? Nestaće svim adminima.')) return
    await supabase.from('platform_announcements').delete().eq('id', id)
    load()
  }

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Platform najave</h1>
          <p className={styles.subtitle}>Poruke svim/filtriranim adminima · važne se prikazuju kao banner</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ alignSelf: 'center', color: '#0d7a52', fontSize: 13 }}>✓ {msg}</span>}
          <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← Super admin</button>
        </div>
      </div>

      {/* Compose */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Nova najava</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Naslov *</label>
          <input className={styles.input} style={{ width: '100%' }} value={form.title} onChange={e => upd('title', e.target.value)} placeholder="npr. Nova funkcija: noćni audit" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Tekst</label>
          <textarea className={styles.input} style={{ width: '100%', minHeight: 90, resize: 'vertical' }} value={form.body} onChange={e => upd('body', e.target.value)} placeholder="Detalji najave…" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Važnost</label>
            <select className={styles.input} value={form.severity} onChange={e => upd('severity', e.target.value)}>
              {SEVERITY.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Kome</label>
            <select className={styles.input} value={form.audience} onChange={e => upd('audience', e.target.value)}>
              {AUDIENCE.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Ističe (opciono)</label>
            <input className={styles.input} type="date" value={form.expires_at} onChange={e => upd('expires_at', e.target.value)} />
          </div>
          <button className={styles.btnPrimary} onClick={publish} disabled={saving}>{saving ? 'Objavljujem…' : '📣 Objavi najavu'}</button>
        </div>
      </div>

      {/* Lista poslatih */}
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Objavljene najave</div>
      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>Još nema objavljenih najava.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(a => {
            const expired = a.expires_at && new Date(a.expires_at) < new Date()
            return (
              <div key={a.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', opacity: expired ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {SEV_LABEL[a.severity] || a.severity} · {a.title}
                      {expired && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--c-text-muted)' }}>(isteklo)</span>}
                    </div>
                    {a.body && <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.body}</div>}
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>
                      {AUD_LABEL[a.audience]} · {new Date(a.published_at).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', flexShrink: 0 }} onClick={() => remove(a.id)}>Obriši</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
