import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

const SEV = {
  info:      { icon: 'ℹ️', label: 'Info',   color: 'var(--c-text-medium)' },
  update:    { icon: '✨', label: 'Novost', color: 'var(--c-primary)' },
  important: { icon: '⚠️', label: 'Važno',  color: 'var(--c-danger)' },
}
const BLANK = { title: '', body: '', expires_at: '' }

export default function NotificationsPage() {
  const { restaurant } = usePlatform()
  const { visible, readIds, markAllRead } = useAnnouncements()
  const { section } = useParams()
  const tab = section === 'tabla' ? 'tabla' : 'najave'

  // Označi najave pročitanim pri otvaranju sekcije „Najave"
  const initialUnread = useRef(null)
  const [unreadSnapshot, setUnreadSnapshot] = useState(() => new Set())
  useEffect(() => {
    if (tab === 'najave' && initialUnread.current === null) {
      const snap = new Set(visible.filter(a => !readIds.has(a.id)).map(a => a.id))
      initialUnread.current = snap
      setUnreadSnapshot(snap)
      if (snap.size) markAllRead()
    }
  }, [tab, visible, readIds, markAllRead])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{tab === 'tabla' ? '📌 Oglasna tabla' : '📣 Najave platforme'}</h1>
          <p className={styles.subtitle}>
            {tab === 'tabla' ? 'Obavijesti za vaše osoblje (vidljive u Staff portalu)' : 'Novosti i obavijesti platforme rest.by.me'}
          </p>
        </div>
      </div>

      {tab === 'najave'
        ? <NajaveTab visible={visible} unreadSnapshot={unreadSnapshot} />
        : <OglasnaTablaTab restaurant={restaurant} />}
    </div>
  )
}

const SEV_FILTERS = [
  { k: 'all', l: 'Sve' }, { k: 'important', l: '⚠️ Važno' }, { k: 'update', l: '✨ Novost' }, { k: 'info', l: 'ℹ️ Info' },
]

function NajaveTab({ visible, unreadSnapshot }) {
  const [q, setQ] = useState('')
  const [sev, setSev] = useState('all')

  const filtered = visible.filter(a => {
    if (sev !== 'all' && a.severity !== sev) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      if (!(a.title.toLowerCase().includes(s) || (a.body || '').toLowerCase().includes(s))) return false
    }
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input className={styles.input} placeholder="🔍 Pretraži najave…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SEV_FILTERS.map(f => (
            <button key={f.k} onClick={() => setSev(f.k)}
              className={sev === f.k ? styles.btnPrimary : styles.btnSecondary} style={{ fontSize: 12, padding: '6px 10px' }}>{f.l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>{visible.length === 0 ? 'Trenutno nema najava.' : 'Nema rezultata za filter.'}</div>
      ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {filtered.map(a => {
        const sev = SEV[a.severity] || SEV.info
        const isNew = unreadSnapshot.has(a.id)
        return (
          <div key={a.id} style={{ background: 'var(--c-surface)', border: `1px solid ${isNew ? 'var(--c-primary)' : 'var(--c-border)'}`, borderLeft: `4px solid ${sev.color}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>{sev.icon} {a.title}</span>
              {isNew && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-primary)', background: 'var(--c-primary-light, #e8f5ee)', borderRadius: 12, padding: '1px 8px' }}>novo</span>}
            </div>
            {a.body && <div style={{ fontSize: 14, color: 'var(--c-text-medium)', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.body}</div>}
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 10 }}>
              {sev.label} · {new Date(a.published_at).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {a.edited_at && ' · izmijenjeno'}
            </div>
          </div>
        )
      })}
    </div>
      )}
    </div>
  )
}

function OglasnaTablaTab({ restaurant }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')   // all | active | expired

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const { data } = await supabase.from('staff_announcements')
      .select('*').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const reset = () => { setForm(BLANK); setEditingId(null); setShowForm(false) }
  const openEdit = (a) => { setEditingId(a.id); setForm({ title: a.title, body: a.body || '', expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '' }); setShowForm(true) }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = { title: form.title.trim(), body: form.body.trim() || null, expires_at: form.expires_at || null }
    if (editingId) {
      await supabase.from('staff_announcements').update({ ...payload, edited_at: new Date().toISOString() }).eq('id', editingId)
    } else {
      await supabase.from('staff_announcements').insert({ restaurant_id: restaurant.id, ...payload })
    }
    setSaving(false); reset(); load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati obavijest?')) return
    await supabase.from('staff_announcements').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>Obavijesti vidljive vašem osoblju u Staff portalu.</div>
        {!showForm && <button className={styles.btnPrimary} onClick={() => { setForm(BLANK); setEditingId(null); setShowForm(true) }}>+ Nova obavijest</button>}
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{editingId ? '✏️ Izmjena obavijesti' : 'Nova obavijest'}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Naslov *</label>
            <input className={styles.input} style={{ width: '100%' }} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="npr. Promjena rasporeda u subotu" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Tekst</label>
            <textarea className={styles.input} style={{ width: '100%', minHeight: 80, resize: 'vertical' }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Ističe (opciono)</label>
            <input className={styles.input} type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className={styles.btnSecondary} onClick={reset}>Odustani</button>
            <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Čuvam…' : (editingId ? 'Sačuvaj izmjene' : 'Objavi')}</button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input className={styles.input} placeholder="🔍 Pretraži obavijesti…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ k: 'all', l: 'Sve' }, { k: 'active', l: 'Aktivne' }, { k: 'expired', l: 'Istekle' }].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={filter === f.k ? styles.btnPrimary : styles.btnSecondary} style={{ fontSize: 12, padding: '6px 10px' }}>{f.l}</button>
            ))}
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (() => {
        const now = new Date()
        const filtered = items.filter(a => {
          const expired = a.expires_at && new Date(a.expires_at) < now
          if (filter === 'active' && expired) return false
          if (filter === 'expired' && !expired) return false
          if (q.trim()) {
            const s = q.trim().toLowerCase()
            if (!(a.title.toLowerCase().includes(s) || (a.body || '').toLowerCase().includes(s))) return false
          }
          return true
        })
        if (items.length === 0) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>Nema obavijesti. Dodaj prvu da je osoblje vidi u portalu.</div>
        if (filtered.length === 0) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>Nema rezultata za filter.</div>
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(a => {
            const expired = a.expires_at && new Date(a.expires_at) < new Date()
            return (
              <div key={a.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '12px 16px', opacity: expired ? 0.6 : 1, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>📌 {a.title}{expired && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}> (isteklo)</span>}</div>
                  {a.body && <div style={{ fontSize: 13, color: 'var(--c-text-medium)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{a.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>
                    {new Date(a.created_at).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {a.edited_at && ' · izmijenjeno'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(a)}>Uredi</button>
                  <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(a.id)}>Obriši</button>
                </div>
              </div>
            )
          })}
        </div>
        )
      })()}
    </div>
  )
}
