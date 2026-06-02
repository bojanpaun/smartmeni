import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useRatePlans(restaurantId) {
  const [ratePlans, setRatePlans] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const { data } = await supabase
      .from('rate_plans')
      .select('*, seasonal_rates(*), rate_plan_rooms(room_id)')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')
    setRatePlans(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  return { ratePlans, loading, refetch: load }
}
