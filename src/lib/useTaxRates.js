import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// FISK — učitava EFEKTIVNE poreske stope za <select> klasifikacije (vat_rate_key):
// per-tenant override (restaurants.tax_rates) ako postoji, inače državne (tax_config).
// Vraća [{key,value,label}] + isCustom (true ako su tenant-stope). Bez restaurantId →
// samo državne stope (kao ranije).
export function useTaxRates(restaurantId = null, country = 'ME') {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCustom, setIsCustom] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (restaurantId) {
        const { data } = await supabase.from('restaurants').select('tax_rates').eq('id', restaurantId).maybeSingle()
        const tenant = Array.isArray(data?.tax_rates) ? data.tax_rates : null
        if (tenant && tenant.length) {
          if (!cancelled) { setRates(tenant); setIsCustom(true); setLoading(false) }
          return
        }
      }
      const { data } = await supabase.from('tax_config').select('rates').eq('country', country).maybeSingle()
      if (!cancelled) { setRates(Array.isArray(data?.rates) ? data.rates : []); setIsCustom(false); setLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [restaurantId, country])

  return { rates, loading, isCustom }
}
