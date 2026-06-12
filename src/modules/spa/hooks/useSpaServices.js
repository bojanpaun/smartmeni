import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

export function useSpaServices(restaurantId) {
  const [services, setServices] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_services')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order')
      .order('name')
    setServices(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const save = async (values, id = null) => {
    const payload = { ...values, restaurant_id: restaurantId }
    // .select().single() → vrati sačuvani red (treba nam id+name+description za AI prevod)
    const { data, error } = id
      ? await supabase.from('spa_services').update(payload).eq('id', id).select().single()
      : await supabase.from('spa_services').insert(payload).select().single()
    if (error) { toast.error('Greška pri čuvanju tretmana'); return null }
    toast.success(id ? 'Tretman ažuriran' : 'Tretman kreiran')
    load()
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from('spa_services').delete().eq('id', id)
    if (error) { toast.error('Greška pri brisanju'); return false }
    toast.success('Tretman obrisan')
    load()
    return true
  }

  const toggle = async (id, is_active) => {
    await supabase.from('spa_services').update({ is_active }).eq('id', id)
    setServices(prev => prev.map(s => s.id === id ? { ...s, is_active } : s))
  }

  return { services, loading, refetch: load, save, remove, toggle }
}
