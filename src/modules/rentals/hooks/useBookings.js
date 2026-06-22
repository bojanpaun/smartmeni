import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

// Učitava rental rezervacije tenanta + realtime sync (CLAUDE.md §7). Ref-pattern:
// load je u useRef, dep array drži SAMO restaurantId (da subscription ne tear-down-uje
// na svaki re-render i ne gubi evente). Channel ime nosi restaurantId. Limit 200
// (paginacija po potrebi kasnije; nov tenant ima malo redova) — §9.
export function useBookings(restaurantId) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(async () => {})

  loadRef.current = async () => {
    if (!restaurantId) return
    const { data } = await supabase.from('rental_bookings')
      .select('id, asset_id, asset:rental_assets(name), guest_name, guest_email, guest_phone, ' +
              'start_date, end_date, status, payment_status, total_amount, deposit, source')
      .eq('restaurant_id', restaurantId)
      .order('start_date', { ascending: false })
      .limit(200)
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    loadRef.current()
    const ch = supabase.channel(`rental-bookings-${restaurantId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rental_bookings', filter: `restaurant_id=eq.${restaurantId}` },
        () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurantId])

  const refetch = useCallback(() => loadRef.current(), [])
  return { bookings, loading, refetch }
}
