import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

// Učitava globalne „Početni koraci" (dashboard_checklist_steps) + per-korisnik RUČNE
// oznake završenih (user_profiles.onboarding_checklist). Vraća steps, manualDone (lista
// step id-jeva), markDone(id) i loaded. Detekciju automatskih koraka (logo/menu/...) radi
// pozivalac iz get_admin_overview brojki (komponenta), pa hook ne radi dodatne upite.
export function useChecklistSteps(userId) {
  const [steps, setSteps] = useState([])
  const [manualDone, setManualDone] = useState([])
  const [dismissed, setDismissedState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('dashboard_checklist_steps')
        .select('id, icon, label, path, detect_key, vertical, perm, addon, module, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      userId
        ? supabase.from('user_profiles').select('onboarding_checklist, checklist_dismissed').eq('id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([{ data: s }, { data: p }]) => {
      if (cancelled) return
      setSteps(s ?? [])
      setManualDone(Array.isArray(p?.onboarding_checklist) ? p.onboarding_checklist : [])
      setDismissedState(!!p?.checklist_dismissed)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [userId])

  // Ručno označi korak završenim (optimistično + perzistuj). Nema „odznači" — jednom
  // završen korak ostaje (kao i detektovani).
  const markDone = useCallback((stepId) => {
    setManualDone(prev => {
      if (prev.includes(stepId)) return prev
      const next = [...prev, stepId]
      if (userId) supabase.from('user_profiles').update({ onboarding_checklist: next }).eq('id', userId)
      return next
    })
  }, [userId])

  // Sakrij/vrati karticu „Početni koraci" (per-korisnik, optimistično + perzistuj).
  const setDismissed = useCallback((value) => {
    setDismissedState(value)
    if (userId) supabase.from('user_profiles').update({ checklist_dismissed: value }).eq('id', userId)
  }, [userId])

  return { steps, manualDone, markDone, dismissed, setDismissed, loaded }
}
