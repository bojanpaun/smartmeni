import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import SupportManager from './SupportManager'
import AnnouncementsManager from './AnnouncementsManager'

// Superadmin komunikacija — lijevi sidebar sa dva taba: Podrška | Obavještenja.
const TABS = [
  { k: 'podrska',     l: '💬 Podrška' },
  { k: 'obavestenja', l: '📣 Obavještenja' },
]

export default function SuperadminCommunication() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()
  const [tab, setTab] = useState('podrska')

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Komunikacija</h1>
          <p className={styles.subtitle}>Podrška tenantima i platform najave</p>
        </div>
        <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← Super admin</button>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 200, flexShrink: 0 }}>
          {TABS.map(t => {
            const active = tab === t.k
            return (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '10px 14px',
                borderRadius: 10, border: `1px solid ${active ? 'var(--c-primary)' : 'transparent'}`,
                background: active ? 'var(--c-primary-light, #e8f5ee)' : 'none',
                color: active ? 'var(--c-primary)' : 'var(--c-text-medium)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}>{t.l}</button>
            )
          })}
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          {tab === 'obavestenja' ? <AnnouncementsManager /> : <SupportManager />}
        </div>
      </div>
    </div>
  )
}
