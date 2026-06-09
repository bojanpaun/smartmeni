import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePlatform } from './PlatformContext'
import { supabase } from '../lib/supabase'

// Support threadovi — role-aware. Vlasnik: svoj restoran (unread = superadmin odgovorio).
// Superadmin: SVI tenanti (unread = admin poslao, superadmin nije pročitao). Za badge na
// kartici „Podrška" i vlasnikov inbox (SupportPage).
const SupportContext = createContext({ conversations: [], unreadCount: 0, reload: () => {} })
export const useSupport = () => useContext(SupportContext)

const isUnreadForAdmin = (c) =>
  c.last_sender_role === 'superadmin' &&
  (!c.admin_last_read_at || new Date(c.last_message_at) > new Date(c.admin_last_read_at))
const isUnreadForSuper = (c) =>
  c.last_sender_role === 'admin' &&
  (!c.superadmin_last_read_at || new Date(c.last_message_at) > new Date(c.superadmin_last_read_at))

export function SupportProvider({ children }) {
  const { restaurant, isSuperAdmin } = usePlatform()
  const superA = isSuperAdmin()
  const rid = restaurant?.id
  const [conversations, setConversations] = useState([])

  const reload = useCallback(async () => {
    let q = supabase.from('support_conversations').select('*').order('last_message_at', { ascending: false })
    if (!superA) {
      if (!rid) { setConversations([]); return }
      q = q.eq('restaurant_id', rid)   // vlasnik: samo svoj restoran
    }                                   // superadmin: svi tenanti
    const { data } = await q
    setConversations(data ?? [])
  }, [rid, superA])

  useEffect(() => {
    if (!superA && !rid) { setConversations([]); return }
    reload()
    const ch = supabase.channel(superA ? 'support-ctx-super' : `support-admin-${rid}`)
    if (superA) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, reload)
    } else {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${rid}` }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter: `restaurant_id=eq.${rid}` }, reload)
    }
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  }, [superA, rid, reload])

  const unreadCount = conversations.filter(superA ? isUnreadForSuper : isUnreadForAdmin).length

  return (
    <SupportContext.Provider value={{ conversations, unreadCount, reload, isUnreadForAdmin }}>
      {children}
    </SupportContext.Provider>
  )
}
