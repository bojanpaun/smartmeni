import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useKitchenCounts(restaurantId, hasHotel = false) {
  const [counts, setCounts] = useState({
    waiter: 0, kitchen: 0, bar: 0,
    waiterReq: 0, housekeeping: 0, maintOpen: 0,
    hotelInquiry: 0, hotelFrontDesk: 0,
  })

  const loadCounts = useCallback(async () => {
    if (!restaurantId) return
    const today = new Date().toISOString().slice(0, 10)
    // Restoranske brojke uvijek; hotelske samo ako tenant ima hotel vertikalu
    // (inače 5 nepotrebnih upita na svaki refresh).
    const queries = [
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
    ]
    if (hasHotel) queries.push(
      supabase.from('housekeeping_tasks').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'in_progress', 'done'])
        .eq('scheduled_for', today),
      supabase.from('maintenance_requests').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .not('status', 'in', '("verified","resolved")'),
      supabase.from('hotel_reservations').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'inquiry').gte('check_out_date', today),
      supabase.from('hotel_reservations').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'confirmed').eq('check_in_date', today),
      supabase.from('hotel_reservations').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'checked_in').eq('check_out_date', today),
    )

    const res = await Promise.all(queries)
    const [waiter, kitchen, bar, waiterReq] = res.map(r => r.count || 0)
    let i = 4
    const housekeeping   = hasHotel ? (res[i++].count || 0) : 0
    const maintOpen      = hasHotel ? (res[i++].count || 0) : 0
    const hotelInquiry   = hasHotel ? (res[i++].count || 0) : 0
    const arrivalsToday  = hasHotel ? (res[i++].count || 0) : 0
    const departuresToday= hasHotel ? (res[i++].count || 0) : 0

    setCounts({
      waiter, kitchen, bar, waiterReq,
      housekeeping, maintOpen, hotelInquiry,
      hotelFrontDesk: arrivalsToday + departuresToday,
    })
  }, [restaurantId, hasHotel])

  useEffect(() => {
    if (!restaurantId) return

    loadCounts()

    let ch = supabase.channel(`kc-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
    if (hasHotel) {
      ch = ch
        .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks',
          filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests',
          filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_reservations',
          filter: `restaurant_id=eq.${restaurantId}` }, loadCounts)
    }
    ch.subscribe()

    return () => supabase.removeChannel(ch)
  }, [restaurantId, hasHotel, loadCounts])

  return { counts, refresh: loadCounts }
}
