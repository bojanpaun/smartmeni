import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import s from '../StaffPortal.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

const ROOM_STATUS_COLORS = {
  available:   { bg: '#f0fdf4', color: '#15803d', labelKey: 'roomAvailable' },
  occupied:    { bg: '#eff6ff', color: '#2563eb', labelKey: 'roomOccupied' },
  cleaning:    { bg: '#fef3c7', color: '#92400e', labelKey: 'roomCleaning' },
  maintenance: { bg: '#fef2f2', color: '#b91c1c', labelKey: 'roomMaintenance' },
  blocked:     { bg: '#f3f4f6', color: '#6b7280', labelKey: 'roomBlocked' },
}

export default function ReceptionView({ restaurantId, activeTab, onRefresh }) {
  const { t } = useTranslation('staffportal')
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

  const loadRef = useRef(load)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`reception-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_reservations',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId])

  const handleCheckin = async (res) => {
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_in',
      actual_check_in: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) { toast.error(t('errCheckin')); return }
    if (res.room_id) await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
    setArrivals(prev => prev.filter(r => r.id !== res.id))
    onRefresh?.()
    toast.success(t('checkinSuccess', { name: res.guest_name }))
  }

  const handleCheckout = async (res) => {
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_out',
      actual_check_out: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) { toast.error(t('errCheckout')); return }
    if (res.room_id) await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', res.room_id)
    setDepartures(prev => prev.filter(r => r.id !== res.id))
    onRefresh?.()
    toast.success(t('checkoutSuccess', { name: res.guest_name }))
  }

  if (loading) return <div className={s.loadingInline}>{t('loading')}</div>

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
                <div className={s.statLabel}>{t(cfg.labelKey)}</div>
              </div>
            ) : null
          ))}
        </div>
        <div className={s.card}>
          <div className={s.cardTitle}>{t('roomStatusTitle')}</div>
          {rooms.map(r => {
            const cfg = ROOM_STATUS_COLORS[r.status] || ROOM_STATUS_COLORS.blocked
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{t('room')} {r.room_number}</div>
                <span className={s.badge} style={{ background: cfg.bg, color: cfg.color }}>{t(cfg.labelKey)}</span>
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
        ? <div className={s.empty}><div className={s.emptyIcon}>🛎️</div><div className={s.emptyText}>{t('noCheckins')}</div></div>
        : arrivals.map(res => (
          <div key={res.id} className={s.resCard}>
            <div className={s.resName}>{res.guest_name}</div>
            <div className={s.resMeta}>
              {res.rooms?.room_number ? `${t('room')} ${res.rooms.room_number}` : t('roomTBD')}
              {' · '}{t('tabCheckout')}: {new Date(res.check_out_date).toLocaleDateString('sr-Latn')}
            </div>
            <div className={s.resActions}>
              <button className={s.btnCheckin} onClick={() => handleCheckin(res)}>↓ {t('tabCheckin')}</button>
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
        ? <div className={s.empty}><div className={s.emptyIcon}>🚪</div><div className={s.emptyText}>{t('noCheckouts')}</div></div>
        : departures.map(res => (
          <div key={res.id} className={s.resCard}>
            <div className={s.resName}>{res.guest_name}</div>
            <div className={s.resMeta}>
              {res.rooms?.room_number ? `${t('room')} ${res.rooms.room_number}` : ''}
              {' · '}{t('tabCheckin')}: {new Date(res.check_in_date).toLocaleDateString('sr-Latn')}
            </div>
            <div className={s.resActions}>
              <button className={s.btnCheckout} onClick={() => handleCheckout(res)}>↑ {t('tabCheckout')}</button>
            </div>
          </div>
        ))
      }
    </div>
  )
}
