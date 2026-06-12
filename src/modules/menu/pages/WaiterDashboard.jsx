import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import styles from './WaiterDashboard.module.css'

async function findOpenFolio(restaurantId, roomNum, t) {
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .ilike('room_number', roomNum.trim())
    .single()
  if (!room) return { error: t('wdRoomNotFound') }

  const { data: res } = await supabase
    .from('hotel_reservations')
    .select('id')
    .eq('room_id', room.id)
    .eq('status', 'checked_in')
    .maybeSingle()
  if (!res) return { error: t('wdGuestNotIn') }

  const { data: folio } = await supabase
    .from('folios')
    .select('id, total_amount')
    .eq('reservation_id', res.id)
    .eq('status', 'open')
    .single()
  if (!folio) return { error: t('wdFolioNotFound') }

  return { folio }
}

const STATUS_CONFIG = {
  pending:   { labelKey: 'wsNew',        color: '#0d7a52', bg: '#E1F5EE' },
  received:  { labelKey: 'wsReceived',   color: '#1D9E75', bg: '#E1F5EE' },
  preparing: { labelKey: 'wsPreparing',  color: '#BA7517', bg: '#FAEEDA' },
  ready:     { labelKey: 'wsReady',      color: '#534AB7', bg: '#EEEDFE' },
  served:    { labelKey: 'wsServed',     color: '#888780', bg: '#F1EFE8' },
  closed:    { labelKey: 'wsClosed',     color: '#888780', bg: '#F1EFE8' },
}

const QUICK_RESPONSE_KEYS = ['wQuick1', 'wQuick2', 'wQuick3', 'wQuick4']
const DEFAULT_REJECT_KEYS = ['wReject1', 'wReject2', 'wReject3', 'wReject4']
const NEXT_LABEL_KEYS = {
  pending: 'nlPending',
  received: 'nlReceived',
  preparing: 'nlPreparing',
  ready: 'nlReady',
  served: 'nlServed',
}

export default function WaiterDashboard() {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const { restaurant, hasAddon } = usePlatform()
  const { refreshCounts } = useAdminBadgeRefresh()
  const hotelEnabled = hasAddon('hotel_core')
  const barCatIdsRef = useRef(null)

  const getBarCatIds = async () => {
    if (!barCatIdsRef.current) {
      const { data } = await supabase.from('categories')
        .select('id').eq('restaurant_id', restaurant.id).eq('is_bar', true)
      barCatIdsRef.current = new Set((data || []).map(c => c.id))
    }
    return barCatIdsRef.current
  }
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

    const handleChange = () => { loadData(); refreshCounts() }
    const channel = supabase
      .channel(`waiter-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, handleChange)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, handleChange)
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
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, ...update } : o
    ).filter(o => o.status !== 'closed'))
  }

  const resolveWaiterReq = async (id, response = null) => {
    await supabase.from('waiter_requests')
      .update({ is_resolved: true, response })
      .eq('id', id)
    setWaiterReqs(prev => prev.filter(r => r.id !== id))
  }

  // Tenant rejection_messages (ako postoje) ostaju kako ih je tenant unio; inače prevedeni default-i.
  const REJECT_MESSAGES = restaurant?.rejection_messages || DEFAULT_REJECT_KEYS.map(k => t(k))

  const NEXT_STATUS = {
    pending: 'received',
    received: 'preparing',
    preparing: 'ready',
    ready: 'served',
    served: 'closed',
  }

  const openRoomCharge = (orderId) =>
    setRoomChargeMap(p => ({ ...p, [orderId]: { roomNum: '', loading: false, error: '' } }))

  const cancelRoomCharge = (orderId) =>
    setRoomChargeMap(p => { const n = { ...p }; delete n[orderId]; return n })

  const chargeToRoom = async (order) => {
    const state = roomChargeMap[order.id]
    if (!state?.roomNum?.trim()) return
    setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: true, error: '' } }))

    const { folio, error } = await findOpenFolio(restaurant.id, state.roomNum, t)
    if (error) {
      setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: false, error } }))
      return
    }

    const amount = parseFloat(order.total) || 0
    const desc = (order.order_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ') || t('wdRestaurantOrder')

    const { error: fiErr } = await supabase.from('folio_items').insert({
      folio_id: folio.id, restaurant_id: restaurant.id,
      type: 'restaurant', description: desc,
      quantity: 1, unit_price: amount, total_price: amount,
      date: new Date().toISOString().slice(0, 10), order_id: order.id,
    })
    if (fiErr) {
      setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: false, error: t('wdFolioWriteErr') } }))
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

  if (loading) return <div className={styles.loading}>{t('loading')}</div>

  return (
    <div>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>{t('wdTitle')}</div>
        <div className={styles.liveBadge}>
          <div className={styles.liveDot}></div>
          {t('realtime')}
        </div>
      </div>

      <div className={styles.content}>


        {/* NARUDŽBE */}
        {activeTab === 'orders' && (
          <div className={styles.orderGrid}>
            {orders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🍽️</div>
                <div>{t('wdNoOrders')}</div>
              </div>
            ) : orders.map(order => {
              const isOnline = order.table_number === 'Online' || !order.table_number
              const statusCfg = STATUS_CONFIG[order.status] || {}
              return (
              <div
                key={order.id}
                className={styles.orderCard}
                style={{ borderLeftColor: statusCfg.color }}
              >
                <div className={styles.orderCardHeader}>
                  <div className={styles.orderMeta}>
                    <div className={styles.tableNum}>
                      <span className={styles.sourceIcon}>{isOnline ? '🌐' : '🪑'}</span>
                      {isOnline ? t('online') : `${t('kdTable')} ${order.table_number}`}
                    </div>
                    <div className={styles.orderRef}>#{order.id.slice(-6).toUpperCase()}</div>
                  </div>
                  <span
                    className={styles.statusPill}
                    style={{ background: statusCfg.bg, color: statusCfg.color }}
                  >
                    {statusCfg.labelKey ? t(statusCfg.labelKey) : ''}
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

                {order.note && (
                  <div className={styles.guestNote}>
                    <span className={styles.guestNoteIcon}>💬</span>
                    {order.note}
                  </div>
                )}

                <div className={styles.orderFooter}>
                  <span className={styles.orderTotal}>€{parseFloat(order.total).toFixed(2)}</span>
                  <span className={styles.orderTime}>
                    {new Date(order.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className={styles.orderActions}>
                  {order.status === 'preparing' && (order.kitchen_status || order.bar_status) ? (
                    <div className={styles.preparingInfo}>
                      {order.kitchen_status === 'preparing' && <span>🧑‍🍳 {t('wdKitchenPreparing')}</span>}
                      {order.bar_status     === 'preparing' && <span>🍷 {t('wdBarPreparing')}</span>}
                      {order.kitchen_status === 'ready'     && <span className={styles.stationDone}>🧑‍🍳 {t('wdKitchenReady')}</span>}
                      {order.bar_status     === 'ready'     && <span className={styles.stationDone}>🍷 {t('wdBarReady')}</span>}
                    </div>
                  ) : NEXT_STATUS[order.status] && (
                    <button
                      className={styles.actionBtn}
                      style={{ background: restaurant?.color || '#0d7a52' }}
                      onClick={() => updateOrderStatus(order.id, NEXT_STATUS[order.status])}
                    >
                      {t(NEXT_LABEL_KEYS[order.status])}
                    </button>
                  )}
                  {order.status === 'served' && hotelEnabled && !roomChargeMap[order.id] && (
                    <button className={styles.roomChargeBtn} onClick={() => openRoomCharge(order.id)}>
                      🏨 {t('wdChargeToRoom')}
                    </button>
                  )}
                  {(order.status === 'received' || order.status === 'pending') && (
                    <div className={styles.rejectWrap}>
                      <div className={styles.rejectLabel}>{t('wdRejectWithMsg')}</div>
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
                    <div className={styles.roomChargePanelTitle}>🏨 {t('wdRoomNumber')}</div>
                    <div className={styles.roomChargeRow}>
                      <input
                        className={styles.roomChargeInput}
                        placeholder={t('wdRoomPlaceholder')}
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
                        {roomChargeMap[order.id].loading ? '...' : t('confirm')}
                      </button>
                      <button className={styles.roomChargeCancel} onClick={() => cancelRoomCharge(order.id)}>
                        {t('cancel')}
                      </button>
                    </div>
                    {roomChargeMap[order.id].error && (
                      <div className={styles.roomChargeError}>{roomChargeMap[order.id].error}</div>
                    )}
                  </div>
                )}
              </div>
            )})}
          </div>
        )}

        {/* POZIVI KONOBARA */}
        {activeTab === 'waiter' && (
          <div className={styles.reqList}>
            {waiterReqs.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🔔</div>
                <div>{t('wdNoReqs')}</div>
              </div>
            ) : waiterReqs.map(req => (
              <div key={req.id} className={`${styles.reqCard} ${!req.is_resolved ? styles.reqNew : ''}`}>
                <div className={styles.reqHeader}>
                  <div className={styles.reqMeta}>
                    <div className={styles.reqTable}>
                      <span className={styles.sourceIcon}>🔔</span>
                      {t('kdTable')} {req.table_number}
                    </div>
                    <div className={styles.reqRef}>#{req.id.slice(-6).toUpperCase()}</div>
                  </div>
                  <div className={styles.reqTime}>
                    {new Date(req.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={styles.reqType}>{req.request_type}</div>
                <div className={styles.quickResponses}>
                  {QUICK_RESPONSE_KEYS.map(k => {
                    const r = t(k)
                    return (
                      <button key={k} className={styles.quickRespBtn}
                        onClick={() => resolveWaiterReq(req.id, r)}>
                        {r}
                      </button>
                    )
                  })}
                </div>
                <button
                  className={styles.resolveBtn}
                  style={{ background: restaurant?.color || '#0d7a52' }}
                  onClick={() => resolveWaiterReq(req.id, null)}
                >
                  {t('wdResolved')} ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
