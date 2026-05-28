import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './WaiterDashboard.module.css'

async function findOpenFolio(restaurantId, roomNum) {
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .ilike('room_number', roomNum.trim())
    .single()
  if (!room) return { error: 'Soba nije pronađena.' }

  const { data: res } = await supabase
    .from('hotel_reservations')
    .select('id')
    .eq('room_id', room.id)
    .eq('status', 'checked_in')
    .single()
  if (!res) return { error: 'Gost nije prijavljen u sobu.' }

  const { data: folio } = await supabase
    .from('folios')
    .select('id, total_amount')
    .eq('reservation_id', res.id)
    .eq('status', 'open')
    .single()
  if (!folio) return { error: 'Folio nije pronađen ili je zatvoren.' }

  return { folio }
}

const STATUS_CONFIG = {
  pending:   { label: 'Nova',        color: '#0d7a52', bg: '#E1F5EE' },
  received:  { label: 'Primljeno',   color: '#1D9E75', bg: '#E1F5EE' },
  preparing: { label: 'U pripremi',  color: '#BA7517', bg: '#FAEEDA' },
  ready:     { label: 'Gotovo',      color: '#534AB7', bg: '#EEEDFE' },
  served:    { label: 'Servirano',   color: '#888780', bg: '#F1EFE8' },
  closed:    { label: 'Zatvoreno',   color: '#888780', bg: '#F1EFE8' },
}

export default function WaiterDashboard() {
  const { restaurant, hasAddon } = usePlatform()
  const hotelEnabled = hasAddon('hotel_core')
  const location = useLocation()
  const [orders, setOrders] = useState([])
  const [waiterReqs, setWaiterReqs] = useState([])
  const [activeTab, setActiveTab] = useState(
    location.pathname.includes('/waiter') ? 'waiter' : 'orders'
  )
  const [roomChargeMap, setRoomChargeMap] = useState({})

  useEffect(() => {
    setActiveTab(location.pathname.includes('/waiter') ? 'waiter' : 'orders')
  }, [location.pathname])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    loadData()

    const channel = supabase
      .channel(`waiter-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => loadData())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => loadData())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [restaurant])

  const loadData = async () => {
    const [{ data: o }, { data: w }] = await Promise.all([
      supabase.from('orders')
        .select('*, order_items(*)')
        .eq('restaurant_id', restaurant.id)
        .not('status', 'eq', 'closed')
        .order('created_at', { ascending: false }),
      supabase.from('waiter_requests')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false }),
    ])
    setOrders(o || [])
    setWaiterReqs(w || [])
    setLoading(false)
  }

  const updateOrderStatus = async (orderId, status, rejectionMessage = null) => {
    const update = { status }
    if (rejectionMessage) update.rejection_message = rejectionMessage
    await supabase.from('orders').update(update).eq('id', orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status } : o
    ).filter(o => o.status !== 'closed'))
  }

  const resolveWaiterReq = async (id, response = null) => {
    await supabase.from('waiter_requests')
      .update({ is_resolved: true, response })
      .eq('id', id)
    setWaiterReqs(prev => prev.filter(r => r.id !== id))
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
  const REJECT_MESSAGES = restaurant?.rejection_messages || DEFAULT_REJECT

  const NEXT_STATUS = {
    pending: 'received',
    received: 'preparing',
    preparing: 'ready',
    ready: 'served',
    served: 'closed',
  }

  const NEXT_LABEL = {
    pending: 'Prihvati narudžbu',
    received: 'Počni pripremu',
    preparing: 'Označi kao gotovo',
    ready: 'Serviraj gostu',
    served: 'Zatvori narudžbu',
  }

  const openRoomCharge = (orderId) =>
    setRoomChargeMap(p => ({ ...p, [orderId]: { roomNum: '', loading: false, error: '' } }))

  const cancelRoomCharge = (orderId) =>
    setRoomChargeMap(p => { const n = { ...p }; delete n[orderId]; return n })

  const chargeToRoom = async (order) => {
    const state = roomChargeMap[order.id]
    if (!state?.roomNum?.trim()) return
    setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: true, error: '' } }))

    const { folio, error } = await findOpenFolio(restaurant.id, state.roomNum)
    if (error) {
      setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: false, error } }))
      return
    }

    const amount = parseFloat(order.total) || 0
    const desc = (order.order_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ') || 'Restoran narudžba'

    const { error: fiErr } = await supabase.from('folio_items').insert({
      folio_id: folio.id, restaurant_id: restaurant.id,
      type: 'restaurant', description: desc,
      quantity: 1, unit_price: amount, total_price: amount,
      date: new Date().toISOString().slice(0, 10), order_id: order.id,
    })
    if (fiErr) {
      setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: false, error: 'Greška pri upisu na folio.' } }))
      return
    }

    await supabase.from('folios').update({
      total_amount: (parseFloat(folio.total_amount) || 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq('id', folio.id)

    await supabase.from('orders').update({ status: 'closed', folio_id: folio.id }).eq('id', order.id)
    setOrders(p => p.filter(o => o.id !== order.id))
    setRoomChargeMap(p => { const n = { ...p }; delete n[order.id]; return n })
  }

  const newOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'received').length
  const newReqsCount = waiterReqs.filter(r => !r.is_resolved).length

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Narudžbe i zahtjevi</div>
        <div className={styles.liveBadge}>
          <div className={styles.liveDot}></div>
          Realtime
        </div>
      </div>

      <div className={styles.content}>


        {/* NARUDŽBE */}
        {activeTab === 'orders' && (
          <div className={styles.orderGrid}>
            {orders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🍽️</div>
                <div>Nema aktivnih narudžbi</div>
              </div>
            ) : orders.map(order => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderCardHeader}>
                  <div className={styles.tableNum}>Sto {order.table_number}</div>
                  <span
                    className={styles.statusPill}
                    style={{
                      background: STATUS_CONFIG[order.status]?.bg,
                      color: STATUS_CONFIG[order.status]?.color
                    }}
                  >
                    {STATUS_CONFIG[order.status]?.label}
                  </span>
                </div>

                <div className={styles.orderItems}>
                  {(order.order_items || []).map(item => (
                    <div key={item.id} className={styles.orderItem}>
                      <span className={styles.itemQty}>{item.quantity}×</span>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.note && <span className={styles.itemNote}>({item.note})</span>}
                    </div>
                  ))}
                </div>

                <div className={styles.orderFooter}>
                  <span className={styles.orderTotal}>€{parseFloat(order.total).toFixed(2)}</span>
                  <span className={styles.orderTime}>
                    {new Date(order.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className={styles.orderActions}>
                  {NEXT_STATUS[order.status] && (
                    <button
                      className={styles.actionBtn}
                      style={{ background: restaurant?.color || '#0d7a52' }}
                      onClick={() => updateOrderStatus(order.id, NEXT_STATUS[order.status])}
                    >
                      {NEXT_LABEL[order.status]}
                    </button>
                  )}
                  {order.status === 'served' && hotelEnabled && !roomChargeMap[order.id] && (
                    <button className={styles.roomChargeBtn} onClick={() => openRoomCharge(order.id)}>
                      🏨 Naplati na sobu
                    </button>
                  )}
                  {(order.status === 'received' || order.status === 'pending') && (
                    <div className={styles.rejectWrap}>
                      <div className={styles.rejectLabel}>Odbij uz poruku:</div>
                      <div className={styles.rejectMessages}>
                        {REJECT_MESSAGES.map(msg => (
                          <button key={msg} className={styles.rejectMsgBtn}
                            onClick={() => updateOrderStatus(order.id, 'closed', msg)}>
                            {msg}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {order.status === 'served' && roomChargeMap[order.id] && (
                  <div className={styles.roomChargePanel}>
                    <div className={styles.roomChargePanelTitle}>🏨 Broj sobe:</div>
                    <div className={styles.roomChargeRow}>
                      <input
                        className={styles.roomChargeInput}
                        placeholder="npr. 101"
                        value={roomChargeMap[order.id].roomNum}
                        onChange={e => setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], roomNum: e.target.value } }))}
                        onKeyDown={e => e.key === 'Enter' && chargeToRoom(order)}
                        autoFocus
                      />
                      <button
                        className={styles.roomChargeConfirm}
                        onClick={() => chargeToRoom(order)}
                        disabled={roomChargeMap[order.id].loading}
                      >
                        {roomChargeMap[order.id].loading ? '...' : 'Potvrdi'}
                      </button>
                      <button className={styles.roomChargeCancel} onClick={() => cancelRoomCharge(order.id)}>
                        Odustani
                      </button>
                    </div>
                    {roomChargeMap[order.id].error && (
                      <div className={styles.roomChargeError}>{roomChargeMap[order.id].error}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* POZIVI KONOBARA */}
        {activeTab === 'waiter' && (
          <div className={styles.reqList}>
            {waiterReqs.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🔔</div>
                <div>Nema aktivnih poziva</div>
              </div>
            ) : waiterReqs.map(req => (
              <div key={req.id} className={`${styles.reqCard} ${!req.is_resolved ? styles.reqNew : ''}`}>
                <div className={styles.reqHeader}>
                  <div className={styles.reqTable}>Sto {req.table_number}</div>
                  <div className={styles.reqTime}>
                    {new Date(req.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={styles.reqType}>{req.request_type}</div>
                <div className={styles.quickResponses}>
                  {QUICK_RESPONSES.map(r => (
                    <button key={r} className={styles.quickRespBtn}
                      onClick={() => resolveWaiterReq(req.id, r)}>
                      {r}
                    </button>
                  ))}
                </div>
                <button className={styles.resolveBtn} onClick={() => resolveWaiterReq(req.id, null)}>
                  Završeno ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
