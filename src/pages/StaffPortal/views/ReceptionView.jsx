import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import s from '../StaffPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const ROOM_STATUS_COLORS = {
  available:   { bg: '#f0fdf4', color: '#15803d', label: 'Slobodna' },
  occupied:    { bg: '#eff6ff', color: '#2563eb', label: 'Zauzeta' },
  cleaning:    { bg: '#fef3c7', color: '#92400e', label: 'Čišćenje' },
  maintenance: { bg: '#fef2f2', color: '#b91c1c', label: 'Održavanje' },
  blocked:     { bg: '#f3f4f6', color: '#6b7280', label: 'Blokirano' },
}

export default function ReceptionView({ restaurantId, activeTab }) {
  const [arrivals, setArrivals]   = useState([])
  const [departures, setDepartures] = useState([])
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: a }, { data: d }, { data: r }] = await Promise.all([
      supabase.from('hotel_reservations')
        .select('id, guest_name, room_id, check_in_date, check_out_date, status, rooms(room_number)')
        .eq('restaurant_id', restaurantId)
        .eq('check_in_date', TODAY)
        .eq('status', 'confirmed')
        .order('created_at'),
      supabase.from('hotel_reservations')
        .select('id, guest_name, room_id, check_in_date, check_out_date, status, rooms(room_number)')
        .eq('restaurant_id', restaurantId)
        .eq('check_out_date', TODAY)
        .eq('status', 'checked_in')
        .order('created_at'),
      supabase.from('rooms')
        .select('id, room_number, status')
        .eq('restaurant_id', restaurantId)
        .order('room_number'),
    ])
    setArrivals(a ?? [])
    setDepartures(d ?? [])
    setRooms(r ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`reception-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_reservations',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  const handleCheckin = async (res) => {
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_in',
      actual_check_in: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) { toast.error('Greška pri check-inu'); return }
    if (res.room_id) await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
    setArrivals(prev => prev.filter(r => r.id !== res.id))
    toast.success(`${res.guest_name} — check-in uspješan`)
  }

  const handleCheckout = async (res) => {
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_out',
      actual_check_out: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) { toast.error('Greška pri check-outu'); return }
    if (res.room_id) await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', res.room_id)
    setDepartures(prev => prev.filter(r => r.id !== res.id))
    toast.success(`${res.guest_name} — check-out. Soba na čišćenje.`)
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  if (activeTab === 'rooms') {
    const grouped = {}
    rooms.forEach(r => {
      grouped[r.status] = (grouped[r.status] || 0) + 1
    })
    return (
      <div>
        <div className={s.statsRow} style={{ flexWrap: 'wrap' }}>
          {Object.entries(ROOM_STATUS_COLORS).map(([st, cfg]) => (
            grouped[st] ? (
              <div key={st} className={s.statCard} style={{ background: cfg.bg, minWidth: 80 }}>
                <div className={s.statNum} style={{ color: cfg.color }}>{grouped[st]}</div>
                <div className={s.statLabel}>{cfg.label}</div>
              </div>
            ) : null
          ))}
        </div>
        <div className={s.card}>
          <div className={s.cardTitle}>Status soba</div>
          {rooms.map(r => {
            const cfg = ROOM_STATUS_COLORS[r.status] || ROOM_STATUS_COLORS.blocked
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Soba {r.room_number}</div>
                <span className={s.badge} style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // checkin tab
  if (activeTab === 'checkin') return (
    <div>
      {arrivals.length === 0
        ? <div className={s.empty}><div className={s.emptyIcon}>🛎️</div><div className={s.emptyText}>Nema check-inova za danas.</div></div>
        : arrivals.map(res => (
          <div key={res.id} className={s.resCard}>
            <div className={s.resName}>{res.guest_name}</div>
            <div className={s.resMeta}>
              {res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : 'Soba TBD'}
              {' · '}Check-out: {new Date(res.check_out_date).toLocaleDateString('sr-Latn')}
            </div>
            <div className={s.resActions}>
              <button className={s.btnCheckin} onClick={() => handleCheckin(res)}>↓ Check-in</button>
            </div>
          </div>
        ))
      }
    </div>
  )

  // checkout tab
  return (
    <div>
      {departures.length === 0
        ? <div className={s.empty}><div className={s.emptyIcon}>🚪</div><div className={s.emptyText}>Nema check-outova za danas.</div></div>
        : departures.map(res => (
          <div key={res.id} className={s.resCard}>
            <div className={s.resName}>{res.guest_name}</div>
            <div className={s.resMeta}>
              {res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : ''}
              {' · '}Check-in: {new Date(res.check_in_date).toLocaleDateString('sr-Latn')}
            </div>
            <div className={s.resActions}>
              <button className={s.btnCheckout} onClick={() => handleCheckout(res)}>↑ Check-out</button>
            </div>
          </div>
        ))
      }
    </div>
  )
}
