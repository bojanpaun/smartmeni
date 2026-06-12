import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

// Tab „Obavještenja" — sve obavijesti oglasne table za osoblje.
export default function NotificationsView({ restaurantId }) {
  const { t } = useTranslation('staffportal')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    supabase.from('staff_announcements').select('*')
      .eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [restaurantId])

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('loading')}</div>

  if (items.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('noAnnouncements')}</div>
  }

  return (
    <div>
      {items.map(a => {
        const expired = a.expires_at && new Date(a.expires_at) < new Date()
        return (
          <div key={a.id} className={s.announcementCard} style={{ opacity: expired ? 0.6 : 1 }}>
            <div className={s.announcementTitle}>📢 {a.title}{expired && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}> ({t('expired')})</span>}</div>
            {a.body && <div className={s.announcementBody}>{a.body}</div>}
            <div className={s.announcementDate}>
              {new Date(a.created_at).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })}
              {a.edited_at && ` · ${t('edited')}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
