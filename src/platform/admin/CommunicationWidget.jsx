import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import { useSupport } from '../../context/SupportContext'
import { supabase } from '../../lib/supabase'
import styles from './ControlPanel.module.css'

const SEV_ICON = { info: 'ℹ️', update: '✨', important: '⚠️' }

// Komunikacija na kontrolnoj tabli: Najave (platforma) · Podrška · Oglasna ploča osoblja
export default function CommunicationWidget() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { visible, unread } = useAnnouncements()
  const { conversations, unreadCount } = useSupport()
  const [staffAnnCount, setStaffAnnCount] = useState(null)

  useEffect(() => {
    if (!restaurant?.id) return
    supabase.from('staff_announcements')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .then(({ count }) => setStaffAnnCount(count ?? 0))
  }, [restaurant?.id])

  const openConvs = conversations.filter(c => c.status === 'open').length

  const card = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }
  const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
  const titleS = { fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }
  const badge = { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#c0392b', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  const link = { marginTop: 'auto', background: 'none', border: 'none', color: 'var(--c-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }
  const muted = { fontSize: 13, color: 'var(--c-text-muted)' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
      {/* Najave */}
      <div style={card}>
        <div style={head}>
          <span style={titleS}>📣 Najave platforme</span>
          {unread.length > 0 && <span style={badge}>{unread.length}</span>}
        </div>
        {visible.length === 0 ? (
          <div style={muted}>Nema najava.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.slice(0, 3).map(a => (
              <div key={a.id} style={{ fontSize: 13, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SEV_ICON[a.severity] || 'ℹ️'} {a.title}
              </div>
            ))}
          </div>
        )}
        <button style={link} onClick={() => navigate('/admin/announcements')}>Sve najave →</button>
      </div>

      {/* Podrška */}
      <div style={card}>
        <div style={head}>
          <span style={titleS}>💬 Podrška</span>
          {unreadCount > 0 && <span style={badge}>{unreadCount}</span>}
        </div>
        <div style={muted}>
          {openConvs > 0 ? `${openConvs} otvoren${openConvs === 1 ? '' : 'ih'} razgovor${openConvs === 1 ? '' : 'a'}` : 'Nemate aktivnih razgovora'}
          {unreadCount > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}> · {unreadCount} nov{unreadCount === 1 ? ' odgovor' : 'a odgovora'}</span>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button style={link} onClick={() => navigate('/admin/support')}>Otvori podršku →</button>
        </div>
      </div>

      {/* Oglasna ploča osoblja */}
      <div style={card}>
        <div style={head}>
          <span style={titleS}>📌 Oglasna ploča</span>
        </div>
        <div style={muted}>
          Poruke vašem osoblju (vidljive u Staff portalu).
          {staffAnnCount !== null && <><br /><strong>{staffAnnCount}</strong> aktivn{staffAnnCount === 1 ? 'a obavijest' : 'ih obavijesti'}</>}
        </div>
        <button style={link} onClick={() => navigate('/admin/hr/staff')}>Upravljaj pločom →</button>
      </div>
    </div>
  )
}
