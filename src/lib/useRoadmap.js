import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Roadmap najave („Šta razvijamo") — učitava AKTIVNE stavke za diskretni ticker
// na dashboardu. Javno čitljivo prijavljenima (RLS platform_roadmap). Jedan fetch.
export function useRoadmap() {
  const [items, setItems] = useState([])
  useEffect(() => {
    let cancelled = false
    supabase.from('platform_roadmap')
      .select('id, title, description')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (!cancelled) setItems(data || []) })
    return () => { cancelled = true }
  }, [])
  return items
}
