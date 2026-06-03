import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import s from '../StaffPortal.module.css'

const NEXT_STATUS = {
  pending:   { next: 'received',  label: 'Prihvati',       cls: 'btnStart' },
  received:  { next: 'preparing', label: 'Počni pripremu', cls: 'btnStart' },
  preparing: { next: 'ready',     label: 'Gotovo',          cls: 'btnDone'  },
  ready:     { next: 'served',    label: 'Serviraj gostu',  cls: 'btnDone'  },
  served:    { next: 'closed',    label: 'Zatvori',         cls: 'btnDone'  },
}

const STATUS_STYLE = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Na čekanju' },
  received:  { bg: '#eff6ff', color: '#2563eb', label: 'Primljeno'  },
  preparing: { bg: '#fef3c7', color: '#b45309', label: 'Priprema'   },
  ready:     { bg: '#f0fdf4', color: '#15803d', label: 'Gotovo'     },
  served:    { bg: '#f3f4f6', color: '#6b7280', label: 'Servirano'  },
}

const QUICK_RESPONSES = [
  'Dolazim odmah!',
  'Za minut sam kod vas.',
  'Za 2-3 minute.',
  'Primljeno, hvala!',
]

const DEFAULT_REJECT = [
  'Žao nam je, ovaj artikal trenutno nije dostupan.',
  'Kuhinja je zauzeta, molimo pokušajte malo kasnije.',
  'Narudžba je primljena greškom, molimo naručite ponovo.',
  'Restoran se zatvara, narudžba nije moguća.',
]

export default function WaiterView({ restaurant, rejectionMessages, activeTab, onRefresh }) {
  const restaurantId = restaurant?.id
  const [orders, setOrders]         = useState([])
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [rejectOpen, setRejectOpen] = useState(null)
  const [fetchedRejectMsgs, setFetchedRejectMsgs] = useState(null)
  const barCatIdsRef = useRef(null)

  // Dohvati rejection_messages direktno via SECURITY DEFINER RPC —
  // zaobilazi RLS koji blokira staff korisnike od čitanja restaurants tabele
  useEffect(() => {
    if (!restaurantId) return
    supabase.rpc('get_restaurant_rejection_messages', { p_restaurant_id: restaurantId })
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) setFetchedRejectMsgs(data)
      })
  }, [restaurantId])

  const rejectMessages = fetchedRejectMsgs || rejectionMessages || restaurant?.rejection_messages || DEFAULT_REJECT

  const getBarCatIds = useCallback(async () => {
    if (!barCatIdsRef.current) {
      const { data } = await supabase.from('categories')
        .select('id').eq('restaurant_id', restaurantId).eq('is_bar', true)
      barCatIdsRef.current = new Set((data || []).map(c => c.id))
    }
    return barCatIdsRef.current
  }, [restaurantId])

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const [{ data: o }, { data: r }] = await Promise.all([
      supabase.from('orders').select('*, order_items(name, quantity, price, category_id)')
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
    const handleChange = () => { load(); onRefresh?.() }
    const ch = supabase.channel(`waiter-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, handleChange)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId, load, onRefresh])

  const updateOrderStatus = async (orderId, status) => {
    const update = { status }

    if (status === 'preparing') {
      const order = orders.find(o => o.id === orderId)
      const items = order?.order_items || []
      const barIds = await getBarCatIds()
      const hasKitchen = items.some(i => !barIds.has(i.category_id))
      const hasBar     = items.some(i =>  barIds.has(i.category_id))
      if (hasKitchen) update.kitchen_status = 'preparing'
      if (hasBar)     update.bar_status     = 'preparing'
    }

    await supabase.from('orders').update(update).eq('id', orderId)
    if (status === 'closed') {
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...update } : o))
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
      ) : requests.map(req => {
        const isOnline = req.table_number === 'Online' || !req.table_number
        return (
          <div key={req.id} className={s.reqCard}>
            <div className={s.reqCardHeader}>
              <div className={s.reqCardMeta}>
                <div className={s.reqSource}>
                  <span className={s.sourceIcon}>{isOnline ? '🌐' : '🪑'}</span>
                  {isOnline ? 'Online' : `Sto ${req.table_number}`}
                </div>
                <div className={s.reqRef}>#{req.id.slice(-6).toUpperCase()}</div>
              </div>
              <div className={s.reqTimeStamp}>
                {new Date(req.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className={s.reqTypeText}>{req.request_type}</div>

            <div className={s.quickRespRow}>
              {QUICK_RESPONSES.map(resp => (
                <button key={resp} className={s.quickRespBtn}
                  onClick={() => resolveRequest(req.id, resp)}>
                  {resp}
                </button>
              ))}
            </div>

            <button className={s.reqResolveBtn} onClick={() => resolveRequest(req.id, null)}>
              ✓ Riješeno
            </button>
          </div>
        )
      })}
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
        const st     = STATUS_STYLE[order.status] || STATUS_STYLE.received
        const action = NEXT_STATUS[order.status]
        const isOnline = order.table_number === 'Online' || !order.table_number
        return (
          <div key={order.id} className={s.orderCard}
            style={{ borderLeftColor: st.color }}>

            <div className={s.orderHeader}>
              <div className={s.orderMeta}>
                <div className={s.orderTable}>
                  <span className={s.sourceIcon}>{isOnline ? '🌐' : '🪑'}</span>
                  {isOnline ? 'Online' : `Sto ${order.table_number}`}
                </div>
                <div className={s.orderRef}>#{order.id.slice(-6).toUpperCase()}</div>
              </div>
              <span className={s.statusBadge} style={{ background: st.bg, color: st.color }}>
                {st.label}
              </span>
            </div>

            <div className={s.orderItems}>
              {(order.order_items || []).map((item, i) => (
                <div key={i} className={s.orderItemRow}>
                  <span className={s.orderItemQty}>{item.quantity}×</span>
                  <span className={s.orderItemName}>{item.name}</span>
                  <span className={s.orderItemPrice}>
                    €{(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {order.total && (
                <div className={s.orderTotalRow}>
                  <span>Ukupno</span>
                  <span>€{parseFloat(order.total).toFixed(2)}</span>
                </div>
              )}
            </div>

            {order.note && (
              <div className={s.orderNote}>
                <span className={s.orderNoteIcon}>💬</span>
                {order.note}
              </div>
            )}

            {/* Reject panel */}
            {rejectOpen === order.id && (
              <div className={s.rejectPanel}>
                <div className={s.rejectPanelLabel}>Razlog odbijanja:</div>
                <div className={s.rejectList}>
                  {rejectMessages.map(msg => (
                    <button key={msg} className={s.rejectListBtn}
                      onClick={() => rejectOrder(order.id, msg)}>
                      {msg}
                    </button>
                  ))}
                  <button className={s.rejectCancelBtn} onClick={() => setRejectOpen(null)}>
                    Odustani
                  </button>
                </div>
              </div>
            )}

            <div className={s.orderActionsCol}>
              {action && (
                <button className={s[action.cls]} onClick={() => updateOrderStatus(order.id, action.next)}>
                  {action.label}
                </button>
              )}
              {['pending', 'received'].includes(order.status) && rejectOpen !== order.id && (
                <button className={s.rejectToggleBtn} onClick={() => setRejectOpen(order.id)}>
                  ✕ Odbij narudžbu
                </button>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}
