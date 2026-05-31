import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const NEXT_STATUS = {
  pending:  { next: 'received',  label: 'Prihvati',      cls: 'btnStart' },
  received: { next: 'preparing', label: 'Počni pripremu', cls: 'btnStart' },
  preparing:{ next: 'ready',     label: 'Gotovo',         cls: 'btnDone' },
  ready:    { next: 'served',    label: 'Serviraj gostu', cls: 'btnDone' },
  served:   { next: 'closed',    label: 'Zatvori',        cls: 'btnDone' },
}

const STATUS_STYLE = {
  pending:  { bg: '#fef3c7', color: '#92400e', label: 'Na čekanju' },
  received: { bg: '#eff6ff', color: '#2563eb', label: 'Primljeno' },
  preparing:{ bg: '#fef3c7', color: '#b45309', label: 'Priprema' },
  ready:    { bg: '#f0fdf4', color: '#15803d', label: 'Gotovo' },
  served:   { bg: '#f3f4f6', color: '#6b7280', label: 'Servirano' },
}

const QUICK_RESPONSES = [
  'Dolazim odmah!',
  'Za minut sam kod vas.',
  'Za 2-3 minute.',
  'Primljeno, hvala!',
]

const REJECT_LABELS = [
  'Artikal nije dostupan',
  'Kuhinja je zauzeta',
  'Narudžba greškom',
  'Restoran se zatvara',
]

export default function WaiterView({ restaurantId, activeTab }) {
  const [orders, setOrders]     = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [rejectOpen, setRejectOpen] = useState(null) // orderId

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

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`waiter-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load])

  const updateOrderStatus = async (orderId, status) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    if (status === 'closed') {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    }
  }

  const rejectOrder = async (orderId, message) => {
    await supabase.from('orders').update({ status: 'rejected', rejection_message: message }).eq('id', orderId)
    setOrders(prev => prev.filter(o => o.id !== orderId))
    setRejectOpen(null)
  }

  const resolveRequest = async (reqId, response = null) => {
    await supabase.from('waiter_requests').update({ is_resolved: true, response }).eq('id', reqId)
    setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  if (loading) return <div className={s.loadingInline}>Učitavanje...</div>

  // ── Zahtjevi tab ─────────────────────────────────────────────────
  if (activeTab === 'requests') return (
    <div>
      {requests.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🔔</div>
          <div className={s.emptyText}>Nema neriješenih zahtjeva.</div>
        </div>
      ) : requests.map(req => (
        <div key={req.id} className={s.card} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Sto {req.table_number || '?'}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{req.request_type}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {new Date(req.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_RESPONSES.map(resp => (
              <button key={resp}
                style={{ background: '#f0fdf4', color: '#15803d', border: '1.5px solid #bbf7d0',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() => resolveRequest(req.id, resp)}
              >
                {resp}
              </button>
            ))}
            <button className={s.reqResolveBtn} onClick={() => resolveRequest(req.id, null)}>
              ✓ Riješeno
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Narudžbe tab ─────────────────────────────────────────────────
  return (
    <div>
      {orders.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🍽️</div>
          <div className={s.emptyText}>Nema aktivnih narudžbi.</div>
        </div>
      ) : orders.map(order => {
        const st = STATUS_STYLE[order.status] || STATUS_STYLE.received
        const action = NEXT_STATUS[order.status]
        return (
          <div key={order.id} className={s.card} style={{ marginBottom: 10, borderLeft: `4px solid ${st.color}` }}>
            <div className={s.orderHeader}>
              <div className={s.orderTable}>Sto {order.table_number || '—'}</div>
              <span className={s.statusBadge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
              <div className={s.orderTime}>
                {new Date(order.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className={s.orderItems}>
              {(order.order_items || []).map((item, i) => (
                <div key={i} className={s.orderItemRow}>
                  <span className={s.orderItemQty}>{item.quantity}×</span>
                  <span>{item.name}</span>
                  <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 12 }}>
                    €{(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {order.total && (
                <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 6, paddingTop: 6,
                  display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
                  <span>Ukupno</span>
                  <span>€{parseFloat(order.total).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Reject panel */}
            {rejectOpen === order.id && (
              <div style={{ background: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>
                  Razlog odbijanja:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {REJECT_LABELS.map(msg => (
                    <button key={msg}
                      style={{ background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca',
                        borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => rejectOrder(order.id, msg)}
                    >
                      {msg}
                    </button>
                  ))}
                  <button
                    style={{ background: '#f3f4f6', color: '#6b7280', border: '1.5px solid #e5e7eb',
                      borderRadius: 8, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => setRejectOpen(null)}
                  >
                    Odustani
                  </button>
                </div>
              </div>
            )}

            <div className={s.orderActions}>
              {action && (
                <button className={s[action.cls]} onClick={() => updateOrderStatus(order.id, action.next)}>
                  {action.label}
                </button>
              )}
              {/* Odbij — dostupno za received i pending */}
              {['pending', 'received'].includes(order.status) && rejectOpen !== order.id && (
                <button
                  style={{ background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca',
                    borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setRejectOpen(order.id)}
                >
                  ✕ Odbij
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
