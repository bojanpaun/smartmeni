import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useGuests(restaurantId, search = '') {
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    let q = supabase
      .from('guests')
      .select('*, hotel_reservations(id, check_in_date, check_out_date, status)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
    }

    const { data } = await q
    setGuests(data ?? [])
    setLoading(false)
  }, [restaurantId, search])

  useEffect(() => { load() }, [load])

  return { guests, loading, refetch: load }
}
