import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

export function useSpaAppointments(restaurantId, date) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_appointments')
      .select(`
        *,
        spa_services(id, name, category, duration_minutes),
        spa_therapists(id, staff!staff_id(first_name, last_name)),
        spa_rooms(id, name)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('appointment_date', date)
      .not('status', 'in', '(cancelled,no_show)')
      .order('start_time')
    setAppointments(data ?? [])
    setLoading(false)
  }, [restaurantId, date])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    const patch = { status }
    if (status === 'completed') patch.payment_status = 'paid'
    const { error } = await supabase.from('spa_appointments').update(patch).eq('id', id)
    if (error) { toast.error('Greška pri ažuriranju'); return false }
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    toast.success(`Status: ${status}`)
    return true
  }

  const cancel = async (id, reason = '') => {
    const { error } = await supabase.from('spa_appointments').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
    }).eq('id', id)
    if (error) { toast.error('Greška pri otkazivanju'); return false }
    toast.success('Termin otkazan')
    load()
    return true
  }

  const create = async (values) => {
    const { error } = await supabase.from('spa_appointments').insert({
      ...values,
      restaurant_id: restaurantId,
    })
    if (error) { toast.error('Greška pri kreiranju termina'); return false }
    toast.success('Termin kreiran')
    load()
    return true
  }

  return { appointments, loading, refetch: load, updateStatus, cancel, create }
}
