import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useKitchenCounts(restaurantId) {
  const [counts, setCounts] = useState({
    waiter: 0, kitchen: 0, bar: 0,
    waiterReq: 0, housekeeping: 0, maintOpen: 0,
  })

  const loadCounts = useCallback(async () => {
    if (!restaurantId) return
    const today = new Date().toISOString().slice(0, 10)
    const [
      { count: waiter },
      { count: kitchen },
      { count: bar },
      { count: waiterReq },
      { count: housekeeping },
      { count: maintOpen },
    ] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).in('status', ['pending', 'received', 'ready']),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('kitchen_status', 'preparing')
        .not('status', 'in', '("served","closed")'),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('bar_status', 'preparing')
        .not('status', 'in', '("served","closed")'),
      supabase.from('waiter_requests').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('is_resolved', false),
      supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'in_progress'])
        .eq('scheduled_for', today),
      supabase.from('maintenance_requests').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .not('status', 'in', '("verified","resolved")'),
    ])
    setCounts({
      waiter:       waiter       || 0,
      kitchen:      kitchen      || 0,
      bar:          bar          || 0,
      waiterReq:    waiterReq    || 0,
      housekeeping: housekeeping || 0,
      maintOpen:    maintOpen    || 0,
    })
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) return

    loadCounts()

    const ch = supabase.channel(`kc-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [restaurantId, loadCounts])

  return { counts, refresh: loadCounts }
}
