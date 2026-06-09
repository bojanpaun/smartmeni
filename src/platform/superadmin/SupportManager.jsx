import { useState, useEffect, useRef } from 'react'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'

// Superadmin support — svi tenanti (sadržaj bez page header-a). Koristi se u
// /superadmin/komunikacija (tab Podrška).
const fmt = (s) => new Date(s).toLocaleString('sr-Latn', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const isUnreadForSuper = (c) =>
  c.last_sender_role === 'admin' &&
  (!c.superadmin_last_read_at || new Date(c.last_message_at) > new Date(c.superadmin_last_read_at))

export default function SupportManager() {
  const { user } = usePlatform()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  const reload = async () => {
    const { data } = await supabase
      .from('support_conversations')
      .select('*, restaurants(name, slug)')
      .order('last_message_at', { ascending: false })
    setConversations(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
    const ch = supabase
      .channel('support-superadmin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, reload)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const openConversation = async (conv) => {
    setSelected(conv)
    const { data } = await supabase.from('support_messages')
      .select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true })
    setMessages(data ?? [])
    await supabase.from('support_conversations')
      .update({ superadmin_last_read_at: new Date().toISOString() }).eq('id', conv.id)
    reload()
  }

  useEffect(() => {
    if (!selected?.id) return
    const ch = supabase.channel(`support-super-thread-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected.id}` },
        payload => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selected?.id])

  const sendReply = async () => {
    const body = reply.trim()
    if (!body || !selected) return
    setSending(true)
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: selected.id, restaurant_id: selected.restaurant_id,
      sender_role: 'superadmin', sender_id: user?.id ?? null, body,
    })
    setSending(false)
    if (error) return
    setReply('')
    await supabase.from('support_conversations')
      .update({ superadmin_last_read_at: new Date().toISOString() }).eq('id', selected.id)
    reload()
  }

  const setStatus = async (status) => {
    if (!selected) return
    await supabase.from('support_conversations').update({ status }).eq('id', selected.id)
    setSelected(s => ({ ...s, status }))
    reload()
  }

  // ── Thread ──
  if (selected) {
    return (
      <div>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title} style={{ fontSize: 18 }}>{selected.subject}</h2>
            <p className={styles.subtitle}>{selected.restaurants?.name ?? '—'} · {selected.status === 'closed' ? 'Zatvoreno' : 'Otvoreno'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selected.status === 'open'
              ? <button className={styles.btnSecondary} onClick={() => setStatus('closed')}>Zatvori</button>
              : <button className={styles.btnSecondary} onClick={() => setStatus('open')}>Ponovo otvori</button>}
            <button className={styles.btnSecondary} onClick={() => { setSelected(null); reload() }}>← Nazad</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {messages.map(m => {
            const mine = m.sender_role === 'superadmin'
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                <div style={{
                  background: mine ? 'var(--c-primary)' : 'var(--c-surface)',
                  color: mine ? '#fff' : 'var(--c-text)',
                  border: mine ? 'none' : '1px solid var(--c-border)',
                  borderRadius: 12, padding: '9px 13px', fontSize: 14, whiteSpace: 'pre-wrap',
                }}>{m.body}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                  {mine ? 'Podrška' : (selected.restaurants?.name ?? 'Admin')} · {fmt(m.created_at)}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {selected.status !== 'closed' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea className={styles.input} style={{ flex: 1, minHeight: 44, resize: 'vertical' }}
              placeholder="Odgovor…" value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }} />
            <button className={styles.btnPrimary} onClick={sendReply} disabled={sending || !reply.trim()}>Pošalji</button>
          </div>
        )}
      </div>
    )
  }

  // ── Lista ──
  const filtered = conversations.filter(c => {
    if (filter === 'open') return c.status === 'open'
    if (filter === 'unread') return isUnreadForSuper(c)
    return true
  })
  const unreadTotal = conversations.filter(isUnreadForSuper).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ k: 'open', l: 'Otvoreni' }, { k: 'unread', l: `Nepročitani (${unreadTotal})` }, { k: 'all', l: 'Svi' }].map(f => (
          <button key={f.k} className={filter === f.k ? styles.btnPrimary : styles.btnSecondary} style={{ fontSize: 13 }} onClick={() => setFilter(f.k)}>{f.l}</button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>Nema konverzacija.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const unread = isUnreadForSuper(c)
            return (
              <button key={c.id} onClick={() => openConversation(c)} style={{
                textAlign: 'left', background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: 12, padding: '12px 16px', cursor: 'pointer', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c0392b', flexShrink: 0 }} />}
                    {c.subject}
                    {c.status === 'closed' && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}>(zatvoreno)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>
                    {c.restaurants?.name ?? '—'} · {fmt(c.last_message_at)}
                  </div>
                </div>
                <span style={{ color: 'var(--c-text-muted)', flexShrink: 0 }}>›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
