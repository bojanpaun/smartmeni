import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// FISK — učitava poreske stope (tax_config.rates) za zemlju (default 'ME') i vraća
// niz [{key,value,label}] za <select> klasifikacije artikala (vat_rate_key). Stope
// su javno čitljive za prijavljene (RLS FISK-1). Jedan fetch po (country).
export function useTaxRates(country = 'ME') {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('tax_config').select('rates').eq('country', country).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setRates(Array.isArray(data?.rates) ? data.rates : [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [country])

  return { rates, loading }
}
