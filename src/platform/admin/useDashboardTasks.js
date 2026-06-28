import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Učitava globalnu listu konfigurabilnih zadataka task trake (dashboard_tasks).
// Lista je ista za sve tenante (superadmin je kurira na /superadmin/dashboard);
// gating po stavci (vertical/perm/addon) radi TaskBar na frontendu. Specificirane
// kolone (ne select('*')) — čita se na admin početnoj (§9). Vraća { tasks, loading }.
export function useDashboardTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('dashboard_tasks')
      .select('id, icon, label, path, vertical, perm, addon, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setTasks(data ?? [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { tasks, loading }
}
