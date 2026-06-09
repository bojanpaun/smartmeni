import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { usePlatform } from './PlatformContext'
import { supabase } from '../lib/supabase'

// Platform najave (superadmin → admini). Jedan provider po admin-mountu (AdminRoute)
// pa zvonce (AdminLayout) i inbox dijele isto stanje. Realtime za live nove najave.
const AnnouncementsContext = createContext({
  visible: [], unread: [], importantUnread: [],
  markRead: () => {}, markAllRead: () => {}, dismissBanner: () => {},
})

export const useAnnouncements = () => useContext(AnnouncementsContext)

const isExpired = (a) => a.expires_at && new Date(a.expires_at) < new Date()

export function AnnouncementsProvider({ children }) {
  const { user, restaurant, isOwner } = usePlatform()
  const owner = isOwner()
  const [announcements, setAnnouncements] = useState([])
  const [readIds, setReadIds] = useState(() => new Set())
  const [dismissed, setDismissed] = useState(() => new Set())  // session: ne prikazuj banner ponovo

  const loadedFor = useRef(null)

  useEffect(() => {
    if (!user?.id || !owner) { setAnnouncements([]); setReadIds(new Set()); return }
    if (loadedFor.current === user.id) return
    loadedFor.current = user.id

    let active = true
    ;(async () => {
      const [{ data: anns }, { data: reads }] = await Promise.all([
        supabase.from('platform_announcements').select('*')
          .order('published_at', { ascending: false }).limit(50),
        supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id),
      ])
      if (!active) return
      setAnnouncements(anns ?? [])
      setReadIds(new Set((reads ?? []).map(r => r.announcement_id)))
    })()

    // Realtime: nova najava stiže uživo
    const ch = supabase
      .channel(`announcements-platform-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_announcements' },
        payload => setAnnouncements(prev => prev.some(a => a.id === payload.new.id) ? prev : [payload.new, ...prev]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'platform_announcements' },
        payload => setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id)))
      .subscribe()

    return () => { active = false; supabase.removeChannel(ch) }
  }, [user?.id, owner])

  const verticals = restaurant?.active_verticals ?? []
  const visible = announcements.filter(a =>
    !isExpired(a) && (a.audience === 'all' || verticals.includes(a.audience)))
  const unread = visible.filter(a => !readIds.has(a.id))
  const importantUnread = unread.filter(a => a.severity === 'important' && !dismissed.has(a.id))
  // Banner: sve nepročitane koje nisu zatvorene u ovoj sesiji (važne prve)
  const sevRank = { important: 0, update: 1, info: 2 }
  const bannerUnread = unread.filter(a => !dismissed.has(a.id))
    .sort((x, y) => (sevRank[x.severity] ?? 9) - (sevRank[y.severity] ?? 9))

  const markRead = useCallback(async (id) => {
    if (!user?.id) return
    setReadIds(prev => prev.has(id) ? prev : new Set(prev).add(id))
    await supabase.from('announcement_reads')
      .upsert({ announcement_id: id, user_id: user.id }, { onConflict: 'announcement_id,user_id' })
  }, [user?.id])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    const ids = unread.map(a => a.id)
    if (!ids.length) return
    setReadIds(prev => { const n = new Set(prev); ids.forEach(i => n.add(i)); return n })
    await supabase.from('announcement_reads')
      .upsert(ids.map(announcement_id => ({ announcement_id, user_id: user.id })), { onConflict: 'announcement_id,user_id' })
  }, [user?.id, unread])

  const dismissBanner = useCallback((id) => {
    setDismissed(prev => new Set(prev).add(id))
    markRead(id)
  }, [markRead])

  return (
    <AnnouncementsContext.Provider value={{ visible, unread, importantUnread, bannerUnread, readIds, markRead, markAllRead, dismissBanner }}>
      {children}
    </AnnouncementsContext.Provider>
  )
}
