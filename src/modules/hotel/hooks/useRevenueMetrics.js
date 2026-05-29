import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function buildDailyMap(rows, from, to) {
  const map = {}
  let cur = from
  while (cur <= to) {
    map[cur] = { date: cur, total_revenue: 0, adr: 0, reservations_count: 0, room_nights_sold: 0 }
    cur = addDays(cur, 1)
  }
  for (const r of rows ?? []) {
    const key = r.date?.slice(0, 10) ?? r.date
    if (map[key]) {
      map[key] = { ...map[key], ...r,
        date: key,
        total_revenue:      Number(r.total_revenue),
        adr:                Number(r.adr),
        reservations_count: Number(r.reservations_count),
        room_nights_sold:   Number(r.room_nights_sold),
      }
    }
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

const MAX_PREV_DAYS = 90

export function useRevenueMetrics(restaurantId, periodDays = 30) {
  const [data, setData]        = useState(null)
  const [suggestions, setSugs] = useState([])
  const [loading, setLoading]  = useState(true)
  const controllerRef          = useRef(null)

  // Otkazivanje učitavanja
  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    setLoading(false)
  }, [])

  const load = useCallback(async () => {
    // Prekinuti prethodni zahtjev ako još traje
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller

    if (!restaurantId) return
    setLoading(true)

    try {
      const today    = isoToday()
      const from     = addDays(today, -periodDays + 1)
      const prevDays = Math.min(periodDays, MAX_PREV_DAYS)
      const prevTo   = addDays(from, -1)
      const prevFrom = addDays(prevTo, -prevDays + 1)

      // Svi upiti u jednom Promise.all + AbortSignal na svakom
      const [
        { data: rows,      error: e1 },
        { data: prevRows,  error: e2 },
        { data: roomsData, error: e3 },
        { data: upcoming,  error: e4 },
        { data: ratePlans, error: e5 },
      ] = await Promise.all([
        // RPC funkcija — direktan index scan, nema aggregate view problema
        supabase.rpc('get_daily_revenue', {
          p_restaurant_id: restaurantId,
          p_from: from,
          p_to: today,
        }).abortSignal(signal),

        supabase.rpc('get_daily_revenue', {
          p_restaurant_id: restaurantId,
          p_from: prevFrom,
          p_to: prevTo,
        }).abortSignal(signal),

        supabase.from('rooms')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .abortSignal(signal),

        supabase.from('hotel_reservations')
          .select('check_in_date, check_out_date, room_type_id, rate_per_night')
          .eq('restaurant_id', restaurantId)
          .gte('check_in_date', today)
          .lte('check_in_date', addDays(today, 30))
          .not('status', 'in', '(cancelled,no_show)')
          .abortSignal(signal),

        supabase.from('rate_plans')
          .select('price_per_night')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .order('price_per_night')
          .limit(1)
          .abortSignal(signal),
      ])

      // Ako je zahtjev otkazan dok smo čekali, ne ažuriraj stanje
      if (signal.aborted) return

      const totalRooms   = roomsData?.count ?? 0
      const daily        = buildDailyMap(rows, from, today)
      const prevDailyArr = prevRows ?? []

      const totalRevenue = daily.reduce((s, d) => s + d.total_revenue, 0)
      const totalNights  = daily.reduce((s, d) => s + d.room_nights_sold, 0)
      const adr          = totalNights > 0 ? totalRevenue / totalNights : 0
      const availNights  = totalRooms * periodDays
      const revpar       = availNights > 0 ? totalRevenue / availNights : 0
      const occupancy    = availNights > 0 ? (totalNights / availNights) * 100 : 0

      const prevRevenue = prevDailyArr.reduce((s, r) => s + Number(r.total_revenue), 0)
      const prevNights  = prevDailyArr.reduce((s, r) => s + Number(r.room_nights_sold), 0)
      const prevAdr     = prevNights > 0 ? prevRevenue / prevNights : 0
      const prevAvail   = totalRooms * prevDays
      const prevRevpar  = prevAvail > 0 ? prevRevenue / prevAvail : 0
      const prevOcc     = prevAvail > 0 ? (prevNights / prevAvail) * 100 : 0

      const pct = (cur, prev) => prev === 0 ? null : ((cur - prev) / prev) * 100

      const upcomingMap = {}
      for (const res of upcoming ?? []) {
        let d = res.check_in_date
        while (d < res.check_out_date) {
          upcomingMap[d] = (upcomingMap[d] || 0) + 1
          d = addDays(d, 1)
        }
      }

      const basePrice = Number(ratePlans?.[0]?.price_per_night ?? 0)
      const sugs = []
      for (let i = 1; i <= 14; i++) {
        const d      = addDays(today, i)
        const booked = upcomingMap[d] || 0
        const occ    = totalRooms > 0 ? booked / totalRooms : 0
        let mult = 1.0
        if (occ > 0.8)      mult += 0.30
        else if (occ > 0.6) mult += 0.15
        else if (occ < 0.3) mult -= 0.10
        if (i < 3 && occ < 0.5)  mult -= 0.15
        if (i > 10 && occ < 0.2) mult -= 0.10
        mult = Math.max(0.5, Math.min(2.0, mult))
        const suggested = Math.round(basePrice * mult)
        if (basePrice > 0 && Math.abs(mult - 1) > 0.05) {
          sugs.push({ date: d, occupancy: Math.round(occ * 100), booked, totalRooms, suggested, basePrice, mult })
        }
      }

      setData({
        daily,
        kpis: {
          totalRevenue, adr, revpar, occupancy,
          pctRevenue: pct(totalRevenue, prevRevenue),
          pctAdr:     pct(adr, prevAdr),
          pctRevpar:  pct(revpar, prevRevpar),
          pctOcc:     pct(occupancy, prevOcc),
        },
        totalRooms,
        prevDays,
      })
      setSugs(sugs)
      setLoading(false)
    } catch (err) {
      if (signal.aborted) return  // tiho ignoriši otkazane zahtjeve
      console.error('useRevenueMetrics error:', err)
      setLoading(false)
    }
  }, [restaurantId, periodDays])

  // Čišćenje pri unmount — prekinuti sve in-flight zahtjeve
  useEffect(() => () => { controllerRef.current?.abort() }, [])

  useEffect(() => { load() }, [load])

  return { data, suggestions, loading, refetch: load, cancel }
}
