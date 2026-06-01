import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useRooms(restaurantId) {
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: rt }, { data: r }] = await Promise.all([
      supabase.from('room_types').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('sort_order'),
      supabase.from('rooms').select('*, room_types(name, base_price)').eq('restaurant_id', restaurantId).order('room_number'),
    ])
    setRoomTypes(rt ?? [])
    setRooms(r ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const updateRoomStatus = async (roomId, status, prevStatus) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status } : r))
    await supabase.from('rooms')
      .update({ status, ...(status === 'available' ? { last_cleaned_at: new Date().toISOString() } : {}) })
      .eq('id', roomId)

    if (status === 'cleaning') {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabase
        .from('housekeeping_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('scheduled_for', today)
        .in('status', ['pending', 'in_progress'])

      if (!count) {
        await supabase.from('housekeeping_tasks').insert({
          restaurant_id: restaurantId,
          room_id: roomId,
          type: prevStatus === 'occupied' ? 'checkout_clean' : 'stayover_clean',
          priority: 'normal',
          status: 'pending',
          scheduled_for: today,
        })
      }
    }

    if (status === 'maintenance') {
      const { count } = await supabase
        .from('maintenance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .not('status', 'in', '("verified","resolved")')

      if (!count) {
        await supabase.from('maintenance_requests').insert({
          restaurant_id: restaurantId,
          room_id: roomId,
          category: 'other',
          priority: 'normal',
          status: 'open',
          description: 'Na servis — postavljeno ručno',
        })
      }
    }
  }

  return { rooms, roomTypes, loading, refetch: load, updateRoomStatus }
}
