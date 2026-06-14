import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

// Tab „Obavještenja" — admin broadcast za osoblje. „Obriši sve" čisti SVOJ prikaz
// (per-user cleared_at); novi/uređeni broadcast se ponovo pojavi. Ne dira deljeni red.
export default function NotificationsView({ restaurantId, userId }) {
  const { t } = useTranslation('staffportal')
  const [items, setItems] = useState([])
  const [clearedAt, setClearedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: anns }, { data: clr }] = await Promise.all([
      supabase.from('staff_announcements').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
      userId
        ? supabase.from('staff_notification_clears').select('cleared_at').eq('user_id', userId).eq('restaurant_id', restaurantId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setItems(anns ?? [])
    setClearedAt(clr?.cleared_at ? new Date(clr.cleared_at) : null)
    setLoading(false)
  }
  useEffect(() => { if (restaurantId) load() }, [restaurantId, userId])

  // Vidljivo = novije (ili uređeno) nakon cleared_at.
  const visible = items.filter(a => {
    if (!clearedAt) return true
    const eff = new Date(a.edited_at || a.created_at)
    return eff > clearedAt
  })

  const clearAll = async () => {
    if (!userId || !confirm(t('notifClearConfirm'))) return
    setBusy(true)
    const { error } = await supabase.from('staff_notification_clears')
      .upsert({ user_id: userId, restaurant_id: restaurantId, cleared_at: new Date().toISOString() }, { onConflict: 'user_id,restaurant_id' })
    setBusy(false)
    if (!error) { setClearedAt(new Date()) }
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('loading')}</div>

  if (visible.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-muted)' }}>{t('noAnnouncements')}</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={clearAll}
          disabled={busy}
          style={{ background: 'none', border: '1px solid var(--c-border-input, var(--c-border))', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--c-text-medium)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🗑️ {t('notifClearAll')}
        </button>
      </div>
      {visible.map(a => {
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
