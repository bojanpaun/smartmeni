import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { usePlatform } from './PlatformContext'
import { supabase } from '../lib/supabase'

// Support threadovi (vlasnikova strana). Kartica „Podrška" + stranica dijele stanje.
// Unread = superadmin odgovorio nakon admin_last_read_at. Superadmin upravlja svim
// tenantima iz /superadmin/podrska (SupportManager — ne koristi ovaj kontekst).
const SupportContext = createContext({ conversations: [], unreadCount: 0, reload: () => {} })
export const useSupport = () => useContext(SupportContext)

const isUnreadForAdmin = (c) =>
  c.last_sender_role === 'superadmin' &&
  (!c.admin_last_read_at || new Date(c.last_message_at) > new Date(c.admin_last_read_at))

export function SupportProvider({ children }) {
  // Učitava konverzacije TEKUĆEG tenanta (vlasnikov inbox) — radi i za superadmina koji
  // ima svoj tenant. Sve-tenanti pregled je odvojeno u /superadmin/podrska (SupportManager).
  const { restaurant } = usePlatform()
  const rid = restaurant?.id
  const [conversations, setConversations] = useState([])
  const ridRef = useRef(null)

  const reload = useCallback(async () => {
    if (!rid) return
    const { data } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('restaurant_id', rid)
      .order('last_message_at', { ascending: false })
    setConversations(data ?? [])
  }, [rid])

  useEffect(() => {
    if (!rid) { setConversations([]); return }
    reload()
    if (ridRef.current === rid) return
    ridRef.current = rid

    const ch = supabase
      .channel(`support-admin-${rid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${rid}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter: `restaurant_id=eq.${rid}` }, reload)
      .subscribe()
    return () => { ridRef.current = null; supabase.removeChannel(ch) }
  }, [rid, reload])

  const unreadCount = conversations.filter(isUnreadForAdmin).length

  return (
    <SupportContext.Provider value={{ conversations, unreadCount, reload, isUnreadForAdmin }}>
      {children}
    </SupportContext.Provider>
  )
}
