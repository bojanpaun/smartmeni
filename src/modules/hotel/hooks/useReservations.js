import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useReservations(restaurantId, filters = {}) {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    let q = supabase
      .from('hotel_reservations')
      .select('*, rooms(room_number, floor), room_types(name)')
      .eq('restaurant_id', restaurantId)
      .order('check_in_date', { ascending: true })

    if (filters.status) q = q.eq('status', filters.status)
    if (filters.dateFrom) q = q.gte('check_in_date', filters.dateFrom)
    if (filters.dateTo) q = q.lte('check_out_date', filters.dateTo)

    const { data } = await q
    setReservations(data ?? [])
    setLoading(false)
  }, [restaurantId, filters.status, filters.dateFrom, filters.dateTo])

  useEffect(() => { load() }, [load])

  return { reservations, loading, refetch: load }
}
