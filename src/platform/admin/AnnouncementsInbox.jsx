import { useEffect, useRef, useState } from 'react'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import styles from '../../modules/hotel/pages/Hotel.module.css'

const SEV = {
  info:      { icon: 'ℹ️', label: 'Info',   color: 'var(--c-text-medium)' },
  update:    { icon: '✨', label: 'Novost', color: '#0d7a52' },
  important: { icon: '⚠️', label: 'Važno',  color: '#c0392b' },
}

export default function AnnouncementsInbox() {
  const { visible, readIds, markAllRead } = useAnnouncements()
  // Zapamti šta je bilo nepročitano pri otvaranju (za „novo" oznaku), pa označi sve.
  const initialUnread = useRef(null)
  const [unreadSnapshot, setUnreadSnapshot] = useState(() => new Set())

  useEffect(() => {
    if (initialUnread.current === null && visible.length >= 0) {
      const snap = new Set(visible.filter(a => !readIds.has(a.id)).map(a => a.id))
      initialUnread.current = snap
      setUnreadSnapshot(snap)
      if (snap.size) markAllRead()
    }
  }, [visible, readIds, markAllRead])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📣 Najave</h1>
          <p className={styles.subtitle}>Obavijesti i novosti platforme rest.by.me</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Trenutno nema najava.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map(a => {
            const sev = SEV[a.severity] || SEV.info
            const isNew = unreadSnapshot.has(a.id)
            return (
              <div key={a.id} style={{
                background: 'var(--c-surface)', border: `1px solid ${isNew ? 'var(--c-primary)' : 'var(--c-border)'}`,
                borderLeft: `4px solid ${sev.color}`, borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{sev.icon} {a.title}</span>
                  {isNew && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-primary)', background: 'var(--c-primary-light, #e8f5ee)', borderRadius: 12, padding: '1px 8px' }}>novo</span>}
                </div>
                {a.body && <div style={{ fontSize: 14, color: 'var(--c-text-medium)', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.body}</div>}
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 10 }}>
                  {sev.label} · {new Date(a.published_at).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
