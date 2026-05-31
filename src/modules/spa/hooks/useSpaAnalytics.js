import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useSpaAnalytics(restaurantId, fromDate, toDate) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId || !fromDate || !toDate) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_appointments')
      .select(`
        id, status, price, duration_minutes, appointment_date, start_time,
        hotel_reservation_id, payment_method,
        spa_services(name, category),
        spa_therapists(id, staff!staff_id(first_name, last_name))
      `)
      .eq('restaurant_id', restaurantId)
      .gte('appointment_date', fromDate)
      .lte('appointment_date', toDate)
      .order('appointment_date')
    setAppointments(data ?? [])
    setLoading(false)
  }, [restaurantId, fromDate, toDate])

  useEffect(() => { load() }, [load])

  // ── Computed metrics ──
  const completed  = appointments.filter(a => a.status === 'completed')
  const noShows    = appointments.filter(a => a.status === 'no_show')
  const confirmed  = appointments.filter(a => a.status === 'confirmed')

  const totalRevenue  = completed.reduce((s, a) => s + Number(a.price), 0)
  const avgRevenue    = completed.length > 0 ? totalRevenue / completed.length : 0
  const noShowRate    = appointments.length > 0 ? (noShows.length / appointments.length) * 100 : 0
  const hotelGuests   = appointments.filter(a => a.hotel_reservation_id).length
  const externalGuests = appointments.length - hotelGuests

  // Revenue by service
  const byService = {}
  completed.forEach(a => {
    const name = a.spa_services?.name || '—'
    if (!byService[name]) byService[name] = { name, count: 0, revenue: 0, minutes: 0 }
    byService[name].count++
    byService[name].revenue   += Number(a.price)
    byService[name].minutes   += Number(a.duration_minutes)
  })
  const serviceStats = Object.values(byService).sort((a, b) => b.revenue - a.revenue)

  // Appointments by therapist
  const byTherapist = {}
  appointments.forEach(a => {
    const st = a.spa_therapists?.staff
    const name = st ? `${st.first_name} ${st.last_name}` : 'Nedodijeljen'
    if (!byTherapist[name]) byTherapist[name] = { name, total: 0, completed: 0, noShow: 0, revenue: 0 }
    byTherapist[name].total++
    if (a.status === 'completed') { byTherapist[name].completed++; byTherapist[name].revenue += Number(a.price) }
    if (a.status === 'no_show')   byTherapist[name].noShow++
  })
  const therapistStats = Object.values(byTherapist).sort((a, b) => b.revenue - a.revenue)

  // Daily revenue trend
  const byDay = {}
  completed.forEach(a => {
    const d = a.appointment_date
    if (!byDay[d]) byDay[d] = { date: d, revenue: 0, count: 0 }
    byDay[d].revenue += Number(a.price)
    byDay[d].count++
  })
  const dailyTrend = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))

  return {
    loading,
    appointments,
    metrics: {
      total: appointments.length, completed: completed.length,
      noShows: noShows.length, confirmed: confirmed.length,
      totalRevenue, avgRevenue, noShowRate,
      hotelGuests, externalGuests,
    },
    serviceStats,
    therapistStats,
    dailyTrend,
  }
}
