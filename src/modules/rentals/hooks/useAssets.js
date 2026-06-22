import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

// Učitava rental sredstva tenanta (jezgro + accommodation detalji + naziv lokacije)
// i listu lokacija za dropdown. Admin lista (nije kritičan prvi render) — eksplicitne
// kolone (CLAUDE.md §3/§9). Svaki upit ima .eq('restaurant_id', …) (defense in depth).
export function useAssets(restaurantId) {
  const [assets, setAssets] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: a }, { data: loc }] = await Promise.all([
      supabase.from('rental_assets')
        .select('id, name, asset_kind, status, base_price, pricing_unit, cleaning_fee, min_duration, location_id, ' +
                'location:rental_locations(id, name, city), ' +
                'details:rental_accommodation_details(max_guests, bedrooms, beds, bathrooms, amenities, access_type, description)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),
      supabase.from('rental_locations')
        .select('id, name, city')
        .eq('restaurant_id', restaurantId)
        .order('name'),
    ])
    setAssets(a || [])
    setLocations(loc || [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { refetch() }, [refetch])

  return { assets, locations, loading, refetch }
}
