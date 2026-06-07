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
    // Sve brojke u jednom RPC pozivu (rasterećuje pooler — ranije ~9 zasebnih
    // count-upita). RPC vraća i hotelske brojke (0 za restoran-only).
    const { data } = await supabase.rpc('get_admin_overview', { p_restaurant_id: restaurantId })
    if (!data) return
    setCounts({
      waiter:         data.waiter        || 0,
      kitchen:        data.kitchen       || 0,
      bar:            data.bar           || 0,
      waiterReq:      data.waiter_req    || 0,
      housekeeping:   data.housekeeping  || 0,
      maintOpen:      data.maint_open    || 0,
      hotelInquiry:   data.hotel_inquiry || 0,
      hotelFrontDesk: (data.hotel_arrivals || 0) + (data.hotel_departures || 0),
    })
  }, [restaurantId])

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
