import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Roadmap najave („Šta razvijamo") — učitava AKTIVNE stavke za diskretni ticker
// na dashboardu. Javno čitljivo prijavljenima (RLS platform_roadmap).
// Master prekidač platform_settings.roadmap_dashboard_enabled gasi cijeli ticker
// odjednom (bez diranja is_active po stavci) — ako je false, vraćamo prazno.
export function useRoadmap() {
  const [items, setItems] = useState([])
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('platform_settings').select('roadmap_dashboard_enabled').limit(1).maybeSingle(),
      supabase.from('platform_roadmap').select('id, title, description').eq('is_active', true).order('sort_order'),
    ]).then(([{ data: settings }, { data: rows }]) => {
      if (cancelled) return
      const enabled = settings?.roadmap_dashboard_enabled ?? true
      setItems(enabled ? (rows || []) : [])
    })
    return () => { cancelled = true }
  }, [])
  return items
}
