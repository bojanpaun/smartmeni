import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useOccupancy(restaurantId) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)

    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

    const [{ data: allRooms }, { data: occupied }, { data: checkInsToday }, { data: checkOutsToday }] = await Promise.all([
      supabase.from('rooms').select('id, status').eq('restaurant_id', restaurantId),
      supabase.from('rooms').select('id').eq('restaurant_id', restaurantId).eq('status', 'occupied'),
      supabase.from('hotel_reservations').select('id').eq('restaurant_id', restaurantId)
        .eq('check_in_date', today).in('status', ['confirmed', 'checked_in']),
      supabase.from('hotel_reservations').select('id').eq('restaurant_id', restaurantId)
        .eq('check_out_date', today).eq('status', 'checked_in'),
    ])

    const total = allRooms?.length ?? 0
    const occupiedCount = occupied?.length ?? 0

    setStats({
      total,
      occupied: occupiedCount,
      available: (allRooms ?? []).filter(r => r.status === 'available').length,
      cleaning:  (allRooms ?? []).filter(r => r.status === 'cleaning').length,
      maintenance: (allRooms ?? []).filter(r => r.status === 'maintenance').length,
      occupancyRate: total ? Math.round((occupiedCount / total) * 100) : 0,
      checkInsToday: checkInsToday?.length ?? 0,
      checkOutsToday: checkOutsToday?.length ?? 0,
    })
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  return { stats, loading, refetch: load }
}
