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

  const updateRoomStatus = async (roomId, status) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status } : r))
    await supabase.from('rooms').update({ status, ...(status === 'available' ? { last_cleaned_at: new Date().toISOString() } : {}) }).eq('id', roomId)
  }

  return { rooms, roomTypes, loading, refetch: load, updateRoomStatus }
}
