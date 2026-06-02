import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useHousekeeping(restaurantId, dateFrom, dateTo) {
  const [tasks, setTasks]     = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)

    let tq = supabase
      .from('housekeeping_tasks')
      .select('*, rooms(room_number, floor, room_types(name)), staff!housekeeping_tasks_assigned_to_fkey(first_name, last_name)')
      .eq('restaurant_id', restaurantId)
      .order('priority', { ascending: false })
      .order('created_at')
    if (dateFrom) tq = tq.gte('scheduled_for', dateFrom)
    if (dateTo)   tq = tq.lte('scheduled_for', dateTo)

    let mq = supabase
      .from('maintenance_requests')
      .select('*, rooms(room_number, floor), staff!maintenance_requests_reported_by_fkey(first_name, last_name)')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'resolved')
      .order('priority', { ascending: false })
      .order('created_at')
    if (dateFrom) mq = mq.gte('created_at', `${dateFrom}T00:00:00Z`)
    if (dateTo)   mq = mq.lte('created_at', `${dateTo}T23:59:59Z`)

    const [{ data: t }, { data: m }, { data: s }] = await Promise.all([
      tq,
      mq,
      supabase
        .from('staff')
        .select('id, first_name, last_name, role:roles!role_id(name)')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('first_name'),
    ])

    setTasks(t ?? [])
    setMaintenance(m ?? [])
    setStaff(s ?? [])
    setLoading(false)
  }, [restaurantId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`hk-rt-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  const updateTaskStatus = async (taskId, status) => {
    const patch = { status }
    if (status === 'in_progress') patch.started_at = new Date().toISOString()
    if (status === 'done')        patch.completed_at = new Date().toISOString()
    const { error } = await supabase.from('housekeeping_tasks').update(patch).eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
      if (status === 'verified') {
        const task = tasks.find(t => t.id === taskId)
        if (task?.room_id) {
          await supabase.from('rooms').update({ status: 'available' }).eq('id', task.room_id)
        }
      }
    }
    return error
  }

  const assignTask = async (taskId, staffId) => {
    const { error } = await supabase.from('housekeeping_tasks')
      .update({ assigned_to: staffId || null }).eq('id', taskId)
    if (!error) load()
    return error
  }

  return { tasks, maintenance, staff, loading, refetch: load, updateTaskStatus, assignTask }
}
