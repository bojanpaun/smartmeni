import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useRatePlans(restaurantId) {
  const [ratePlans, setRatePlans] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)

    // Pokušaj s rate_plan_rooms; ako tabela još ne postoji (400) — fallback
    const { data, error } = await supabase
      .from('rate_plans')
      .select('*, seasonal_rates(*), rate_plan_rooms(room_id)')
      .eq('restaurant_id', restaurantId)
      .order('sort_order')

    if (error) {
      const { data: fallback } = await supabase
        .from('rate_plans')
        .select('*, seasonal_rates(*)')
        .eq('restaurant_id', restaurantId)
        .order('sort_order')
      setRatePlans((fallback ?? []).map(p => ({ ...p, rate_plan_rooms: [] })))
    } else {
      setRatePlans(data ?? [])
    }

    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  return { ratePlans, loading, refetch: load }
}
