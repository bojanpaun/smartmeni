import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const STATUS_COLORS = {
  received:  { bg: '#eff6ff', color: '#2563eb', label: 'Primljeno' },
  preparing: { bg: '#fef3c7', color: '#92400e', label: 'Priprema' },
  ready:     { bg: '#f0fdf4', color: '#15803d', label: 'Gotovo' },
  served:    { bg: '#f3f4f6', color: '#6b7280', label: 'Servirano' },
}

export default function WaiterView({ restaurantId, activeTab }) {
  const [orders, setOrders]     = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: o }, { data: r }] = await Promise.all([
      supabase.from('orders').select('*, order_items(name, quantity, price)')
        .eq('restaurant_id', restaurantId)
        .not('status', 'in', '(closed,rejected)')
        .order('created_at', { ascending: false }),
      supabase.from('waiter_requests').select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false }),
    ])
    setOrders(o ?? [])
    setRequests(r ?? [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  // Real-time
  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`waiter-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests', filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  const updateOrderStatus = async (orderId, status) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    if (status === 'closed') setOrders(prev => prev.filter(o => o.id !== orderId))
    else setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
  }

  const resolveRequest = async (reqId) => {
    await supabase.from('waiter_requests').update({ is_resolved: true }).eq('id', reqId)
    setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  if (activeTab === 'requests') return (
    <div>
      {requests.length === 0 ? (
        <div className={s.empty}><div className={s.emptyIcon}>🔔</div><div className={s.emptyText}>Nema neriješenih zahtjeva.</div></div>
      ) : requests.map(r => (
        <div key={r.id} className={s.reqCard}>
          <div>
            <div className={s.reqTable}>Sto {r.table_number || '?'}</div>
            <div className={s.reqType}>{r.request_type}</div>
            <div className={s.reqTime}>{new Date(r.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button className={s.reqResolveBtn} onClick={() => resolveRequest(r.id)}>✓ Riješeno</button>
        </div>
      ))}
    </div>
  )

  // orders tab
  return (
    <div>
      {orders.length === 0 ? (
        <div className={s.empty}><div className={s.emptyIcon}>🍽️</div><div className={s.emptyText}>Nema aktivnih narudžbi.</div></div>
      ) : orders.map(order => {
        const st = STATUS_COLORS[order.status] || STATUS_COLORS.received
        return (
          <div key={order.id} className={`${s.orderCard} ${order.status === 'received' ? s.orderCardNew : order.status === 'ready' ? s.orderCardReady : s.orderCardPreparing}`}>
            <div className={s.orderHeader}>
              <div className={s.orderTable}>Sto {order.table_number || '—'}</div>
              <span className={s.statusBadge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
              <div className={s.orderTime}>{new Date(order.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div className={s.orderItems}>
              {(order.order_items || []).map((item, i) => (
                <div key={i} className={s.orderItemRow}>
                  <span className={s.orderItemQty}>{item.quantity}×</span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
            <div className={s.orderActions}>
              {order.status === 'ready' && (
                <button className={s.btnDone} onClick={() => updateOrderStatus(order.id, 'served')}>✓ Servirano</button>
              )}
              {order.status === 'served' && (
                <button className={s.btnDone} onClick={() => updateOrderStatus(order.id, 'closed')}>✓ Zatvori</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
