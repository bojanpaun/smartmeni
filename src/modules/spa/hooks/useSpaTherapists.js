import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

export function useSpaTherapists(restaurantId) {
  const [therapists, setTherapists] = useState([])
  const [staff, setStaff]           = useState([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase
        .from('spa_therapists')
        .select(`
          *,
          staff!staff_id(id, first_name, last_name, role:roles!role_id(name)),
          spa_therapist_services(service_id, spa_services(id, name))
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at'),
      supabase
        .from('staff')
        .select('id, first_name, last_name, role:roles!role_id(name)')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('first_name'),
    ])
    setTherapists(t ?? [])
    setStaff(s ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const save = async (values, serviceIds = [], id = null) => {
    const payload = {
      staff_id: values.staff_id,
      restaurant_id: restaurantId,
      bio: values.bio || null,
      specializations: values.specializations || [],
      languages: values.languages || ['bs'],
      is_available: values.is_available ?? true,
    }

    let therapistId = id
    if (id) {
      const { error } = await supabase.from('spa_therapists').update(payload).eq('id', id)
      if (error) { toast.error('Greška pri ažuriranju terapeuta'); return false }
    } else {
      const { data, error } = await supabase.from('spa_therapists').insert(payload).select('id').single()
      if (error) { toast.error('Greška pri kreiranju terapeuta'); return false }
      therapistId = data.id
    }

    // Sync spa_therapist_services
    await supabase.from('spa_therapist_services').delete().eq('therapist_id', therapistId)
    if (serviceIds.length > 0) {
      await supabase.from('spa_therapist_services').insert(
        serviceIds.map(sid => ({ therapist_id: therapistId, service_id: sid }))
      )
    }

    toast.success(id ? 'Terapeut ažuriran' : 'Terapeut kreiran')
    load()
    return true
  }

  const remove = async (id) => {
    const { error } = await supabase.from('spa_therapists').delete().eq('id', id)
    if (error) { toast.error('Greška pri brisanju'); return false }
    toast.success('Terapeut obrisan')
    load()
    return true
  }

  const toggleAvailable = async (id, is_available) => {
    await supabase.from('spa_therapists').update({ is_available }).eq('id', id)
    setTherapists(prev => prev.map(t => t.id === id ? { ...t, is_available } : t))
  }

  return { therapists, staff, loading, refetch: load, save, remove, toggleAvailable }
}
