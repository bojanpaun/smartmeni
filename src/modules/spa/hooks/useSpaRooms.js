import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

export function useSpaRooms(restaurantId) {
  const [rooms, setRooms]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_rooms')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order')
      .order('name')
    setRooms(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const save = async (values, id = null) => {
    const payload = { ...values, restaurant_id: restaurantId }
    const { error } = id
      ? await supabase.from('spa_rooms').update(payload).eq('id', id)
      : await supabase.from('spa_rooms').insert(payload)
    if (error) { toast.error('Greška pri čuvanju kabine'); return false }
    toast.success(id ? 'Kabina ažurirana' : 'Kabina kreirana')
    load()
    return true
  }

  const remove = async (id) => {
    const { error } = await supabase.from('spa_rooms').delete().eq('id', id)
    if (error) { toast.error('Greška pri brisanju'); return false }
    toast.success('Kabina obrisana')
    load()
    return true
  }

  return { rooms, loading, refetch: load, save, remove }
}
