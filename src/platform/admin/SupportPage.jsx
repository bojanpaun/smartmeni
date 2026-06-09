import { useState, useEffect, useRef } from 'react'
import { usePlatform } from '../../context/PlatformContext'
import { useSupport } from '../../context/SupportContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import SupportAdmin from '../superadmin/SupportAdmin'

const fmt = (s) => new Date(s).toLocaleString('sr-Latn', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Role-aware: superadmin vidi svih tenanata (SupportAdmin), vlasnik svoj inbox.
export default function SupportPage() {
  const platform = usePlatform()
  if (platform.isSuperAdmin()) return <SupportAdmin />
  return <OwnerSupport />
}

function OwnerSupport() {
  const { user, restaurant } = usePlatform()
  const { conversations, reload, isUnreadForAdmin } = useSupport()

  const [selected, setSelected] = useState(null)   // conversation
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  // Nova konverzacija
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState('')
  const [firstMsg, setFirstMsg] = useState('')

  const endRef = useRef(null)

  const loadMessages = async (convId) => {
    setLoadingMsgs(true)
    const { data } = await supabase.from('support_messages')
      .select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoadingMsgs(false)
  }

  // Otvori konverzaciju → učitaj poruke, označi pročitano, pretplati se na nove
  const openConversation = async (conv) => {
    setSelected(conv); setComposing(false)
    await loadMessages(conv.id)
    await supabase.from('support_conversations')
      .update({ admin_last_read_at: new Date().toISOString() }).eq('id', conv.id)
    reload()
  }

  // Realtime na poruke otvorene konverzacije
  useEffect(() => {
    if (!selected?.id) return
    const ch = supabase
      .channel(`support-thread-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected.id}` },
        payload => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selected?.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendReply = async () => {
    const body = reply.trim()
    if (!body || !selected) return
    setSending(true)
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: selected.id, restaurant_id: restaurant.id,
      sender_role: 'admin', sender_id: user.id, body,
    })
    setSending(false)
    if (error) return
    setReply('')
    // optimistički + realtime; označi pročitano svoje
    await supabase.from('support_conversations')
      .update({ admin_last_read_at: new Date().toISOString() }).eq('id', selected.id)
    reload()
  }

  const createConversation = async () => {
    if (!subject.trim() || !firstMsg.trim()) return
    setSending(true)
    const { data: conv, error } = await supabase.from('support_conversations')
      .insert({ restaurant_id: restaurant.id, subject: subject.trim(), created_by: user.id })
      .select().single()
    if (error || !conv) { setSending(false); return }
    await supabase.from('support_messages').insert({
      conversation_id: conv.id, restaurant_id: restaurant.id,
      sender_role: 'admin', sender_id: user.id, body: firstMsg.trim(),
    })
    setSending(false)
    setSubject(''); setFirstMsg(''); setComposing(false)
    reload()
    openConversation(conv)
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  // ── Thread prikaz ──
  if (selected) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title} style={{ fontSize: 20 }}>{selected.subject}</h1>
            <p className={styles.subtitle}>{selected.status === 'closed' ? 'Zatvoreno' : 'Otvoreno'} · podrška rest.by.me</p>
          </div>
          <button className={styles.btnSecondary} onClick={() => { setSelected(null); reload() }}>← Nazad</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {loadingMsgs ? <LoadingSpinner /> : messages.map(m => {
            const mine = m.sender_role === 'admin'
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                <div style={{
                  background: mine ? 'var(--c-primary)' : 'var(--c-surface)',
                  color: mine ? '#fff' : 'var(--c-text)',
                  border: mine ? 'none' : '1px solid var(--c-border)',
                  borderRadius: 12, padding: '9px 13px', fontSize: 14, whiteSpace: 'pre-wrap',
                }}>{m.body}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                  {mine ? 'Vi' : 'Podrška'} · {fmt(m.created_at)}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {selected.status !== 'closed' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea className={styles.input} style={{ flex: 1, minHeight: 44, resize: 'vertical' }}
              placeholder="Napišite poruku…" value={reply} onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }} />
            <button className={styles.btnPrimary} onClick={sendReply} disabled={sending || !reply.trim()}>Pošalji</button>
          </div>
        )}
      </div>
    )
  }

  // ── Lista konverzacija ──
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>💬 Podrška</h1>
          <p className={styles.subtitle}>Pitanja i pomoć tima rest.by.me</p>
        </div>
        {!composing && <button className={styles.btnPrimary} onClick={() => setComposing(true)}>+ Nova poruka</button>}
      </div>

      {composing && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Naslov *</label>
            <input className={styles.input} style={{ width: '100%' }} value={subject} onChange={e => setSubject(e.target.value)} placeholder="npr. Pitanje o rezervacijama" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--c-text-medium)', display: 'block', marginBottom: 4 }}>Poruka *</label>
            <textarea className={styles.input} style={{ width: '100%', minHeight: 90, resize: 'vertical' }} value={firstMsg} onChange={e => setFirstMsg(e.target.value)} placeholder="Opišite pitanje ili problem…" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className={styles.btnSecondary} onClick={() => setComposing(false)}>Odustani</button>
            <button className={styles.btnPrimary} onClick={createConversation} disabled={sending || !subject.trim() || !firstMsg.trim()}>Pošalji</button>
          </div>
        </div>
      )}

      {conversations.length === 0 && !composing ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Nemate poruka. Otvorite novu ako vam treba pomoć.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {conversations.map(c => {
            const unread = isUnreadForAdmin(c)
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
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>{fmt(c.last_message_at)}</div>
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
