import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

function ageMin(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

export default function KitchenView({ restaurantId, onRefresh }) {
  const [orders, setOrders]   = useState([])
  const [barCatIds, setBarCatIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    supabase.from('categories').select('id')
      .eq('restaurant_id', restaurantId).eq('is_bar', true)
      .then(({ data }) => setBarCatIds(new Set((data || []).map(c => c.id))))
  }, [restaurantId])

  const load = useCallback(async () => {
    if (!restaurantId) return
    const { data } = await supabase.from('orders')
      .select('*, order_items(id, name, quantity, note, category_id)')
      .eq('restaurant_id', restaurantId)
      .eq('kitchen_status', 'preparing')
      .not('status', 'in', '("served","closed")')
      .order('created_at')
    setOrders(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const loadRef = useRef(load)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`kitchen-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId])

  const markReady = async (orderId) => {
    await supabase.from('orders').update({ kitchen_status: 'ready' }).eq('id', orderId)

    // Ako je i bar_status done (ready ili null), postavi ukupni status na 'ready'
    const { data: current } = await supabase.from('orders')
      .select('kitchen_status, bar_status').eq('id', orderId).maybeSingle()
    if (current) {
      const barDone = !current.bar_status || current.bar_status === 'ready'
      if (barDone) await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)
    }

    setOrders(prev => prev.filter(o => o.id !== orderId))
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  return (
    <div>
      {orders.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🍳</div>
          <div className={s.emptyText}>Sve narudžbe su odrađene!</div>
        </div>
      ) : (
        <div className={s.kitchenGrid}>
          {orders.map(order => {
            const age = ageMin(order.created_at)
            const kitchenItems = (order.order_items || []).filter(i => !barCatIds.has(i.category_id))
            return (
              <div key={order.id} className={`${s.ticket} ${s.ticketPreparing} ${age > 15 ? s.ticketUrgent : ''}`}>
                <div className={s.ticketHeader}>
                  <div className={s.ticketTable}>
                    {order.table_number === 'Online' || !order.table_number ? '🌐 Online' : `🪑 Sto ${order.table_number}`}
                  </div>
                  <div className={s.ticketAge} style={{ color: age > 15 ? '#c0392b' : '#9ca3af' }}>{age}min</div>
                </div>
                {kitchenItems.map((item, i) => (
                  <div key={i} className={s.ticketItem}>
                    <span className={s.ticketQty}>{item.quantity}×</span>
                    <div>
                      <span>{item.name}</span>
                      {item.note && <div className={s.ticketItemNote}>⚠ {item.note}</div>}
                    </div>
                  </div>
                ))}
                <div className={s.ticketActions}>
                  <button className={s.btnDone} onClick={() => markReady(order.id)}>✓ Gotovo</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
