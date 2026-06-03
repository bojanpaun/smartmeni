import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useReservationCounts(restaurantId, { checkInFrom, checkInTo } = {}) {
  const [counts, setCounts] = useState({})

  const load = useCallback(async () => {
    if (!restaurantId) return
    let q = supabase
      .from('hotel_reservations')
      .select('status')
      .eq('restaurant_id', restaurantId)
    if (checkInFrom) q = q.gte('check_in_date', checkInFrom)
    if (checkInTo)   q = q.lte('check_in_date', checkInTo)
    const { data } = await q
    if (!data) return
    const c = {}
    for (const r of data) {
      c[r.status] = (c[r.status] || 0) + 1
    }
    c[''] = data.length
    setCounts(c)
  }, [restaurantId, checkInFrom, checkInTo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`res-counts-rt-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_reservations',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  return counts
}
