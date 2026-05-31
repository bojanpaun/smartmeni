import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

function ageMin(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

export default function KitchenView({ restaurantId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    const { data } = await supabase.from('orders')
      .select('*, order_items(name, quantity)')
      .eq('restaurant_id', restaurantId)
      .in('status', ['received', 'preparing'])
      .order('created_at')
    setOrders(data ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`kitchen-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  const markPreparing = async (id) => {
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' } : o))
  }

  const markReady = async (id) => {
    await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  return (
    <div>
      {orders.length === 0 ? (
        <div className={s.empty}><div className={s.emptyIcon}>🍳</div><div className={s.emptyText}>Nema aktivnih narudžbi.</div></div>
      ) : (
        <div className={s.kitchenGrid}>
          {orders.map(order => {
            const age = ageMin(order.created_at)
            const isNew = order.status === 'received'
            return (
              <div key={order.id} className={`${s.ticket} ${isNew ? s.ticketNew : s.ticketPreparing}`}>
                <div className={s.ticketHeader}>
                  <div className={s.ticketTable}>Sto {order.table_number || '—'}</div>
                  <div className={s.ticketAge} style={{ color: age > 15 ? '#c0392b' : '#9ca3af' }}>{age}min</div>
                </div>
                {(order.order_items || []).map((item, i) => (
                  <div key={i} className={s.ticketItem}>
                    <span className={s.ticketQty}>{item.quantity}×</span>
                    <span>{item.name}</span>
                  </div>
                ))}
                <div className={s.ticketActions}>
                  {isNew && <button className={s.btnStart} onClick={() => markPreparing(order.id)}>▶ Počni pripremu</button>}
                  {order.status === 'preparing' && <button className={s.btnDone} onClick={() => markReady(order.id)}>✓ Gotovo</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
