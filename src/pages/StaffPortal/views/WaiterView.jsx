import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { translateContent, orderRejectionFields } from '../../../lib/contentTranslate'
import { formatMoney } from '../../../lib/currencies'
import { openInvoicePrintWindow } from '../../../lib/invoicePrint'
import toast from 'react-hot-toast'
import NewOrderView from './NewOrderView'
import s from '../StaffPortal.module.css'

async function findOpenFolio(restaurantId, roomNum, t) {
  const { data: room } = await supabase.from('rooms').select('id')
    .eq('restaurant_id', restaurantId).ilike('room_number', roomNum.trim()).single()
  if (!room) return { error: t('errRoomNotFound') }

  const { data: res } = await supabase.from('hotel_reservations').select('id')
    .eq('room_id', room.id).eq('status', 'checked_in').maybeSingle()
  if (!res) return { error: t('errGuestNotCheckedIn') }

  const { data: folio } = await supabase.from('folios').select('id, total_amount')
    .eq('reservation_id', res.id).eq('status', 'open').single()
  if (!folio) return { error: t('errFolioNotFound') }

  return { folio }
}

const NEXT_STATUS = {
  pending:   { next: 'received',  labelKey: 'nsAccept',       cls: 'btnStart' },
  received:  { next: 'preparing', labelKey: 'nsStartPrep', cls: 'btnStart' },
  preparing: { next: 'ready',     labelKey: 'nsReady',          cls: 'btnDone'  },
  ready:     { next: 'served',    labelKey: 'nsServe',  cls: 'btnDone'  },
  served:    { next: 'closed',    labelKey: 'nsClose',         cls: 'btnDone'  },
}

const STATUS_STYLE = {
  pending:   { bg: '#fef3c7', color: '#92400e', labelKey: 'ssPending' },
  received:  { bg: '#eff6ff', color: '#2563eb', labelKey: 'ssReceived'  },
  preparing: { bg: '#fef3c7', color: '#b45309', labelKey: 'ssPreparing'   },
  ready:     { bg: '#f0fdf4', color: '#15803d', labelKey: 'ssReady'     },
  served:    { bg: '#f3f4f6', color: '#6b7280', labelKey: 'ssServed'  },
}

const QUICK_RESPONSE_KEYS = ['quickResp1', 'quickResp2', 'quickResp3', 'quickResp4']
const DEFAULT_REJECT_KEYS = ['reject1', 'reject2', 'reject3', 'reject4']

export default function WaiterView({ restaurant, activeTab, onRefresh, hotelEnabled, fiscalEnabled }) {
  const { t, i18n } = useTranslation('staffportal')
  const money = (a) => formatMoney(a, restaurant?.currency, i18n.language)
  const restaurantId = restaurant?.id
  const [invoicing, setInvoicing] = useState(null) // order_id u toku
  const [newMode, setNewMode] = useState(false)    // konobarski unos nove narudžbe

  // Izdaj (idempotentno) + odštampaj račun za narudžbu — propušteni račun se vrati isti.
  const printOrderInvoice = async (orderId) => {
    setInvoicing(orderId)
    const { data: inv, error } = await supabase.rpc('create_invoice_from_order', { p_order_id: orderId })
    if (error || !inv) { setInvoicing(null); toast.error(t('spwInvoiceErr')); return }
    const { data: items } = await supabase.from('invoice_items')
      .select('name, quantity, vat_rate_key, total_cents').eq('invoice_id', inv.id).order('sort_order')
    openInvoicePrintWindow({
      invoice: inv, items: items || [], restaurant, lang: i18n.language,
      labels: {
        taxId: t('spwTaxId'), vatNumber: t('spwVatNumber'), iban: t('spwIban'),
        number: t('spwNumber'), date: t('spwDate'), status: t('spwStatus'), statusValue: t('spwStatusValue'),
        name: t('spwItem'), qty: t('spwQty'), vat: t('spwVat'), total: t('spwTotal'), base: t('spwBase'),
        footnote: t('spwFootnote'),
      },
    })
    setInvoicing(null)
  }
  const [orders, setOrders]         = useState([])
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [roomChargeMap, setRoomChargeMap] = useState({})
  const barCatIdsRef = useRef(null)

  // Isti pristup kao /admin/orders (WaiterDashboard) — direktno iz restaurant prop.
  // Tenant rejection_messages (ako postoje) ostaju kako ih je tenant unio; inače
  // prevedeni default-i.
  const rejectMessages = restaurant?.rejection_messages || DEFAULT_REJECT_KEYS.map(k => t(k))

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

  const loadRef = useRef(load)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`waiter-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests',
        filter: `restaurant_id=eq.${restaurantId}` }, () => { loadRef.current(); onRefreshRef.current?.() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId])

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
    const desc = (order.order_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ') || t('restaurantOrder')

    const { error: fiErr } = await supabase.from('folio_items').insert({
      folio_id: folio.id, restaurant_id: restaurant.id,
      type: 'restaurant', description: desc,
      quantity: 1, unit_price: amount, total_price: amount,
      date: new Date().toISOString().slice(0, 10), order_id: order.id,
    })
    if (fiErr) {
      setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], loading: false, error: t('errFolioWrite') } }))
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

  const rejectOrder = async (orderId, message) => {
    await supabase.from('orders').update({ status: 'closed', rejection_message: message }).eq('id', orderId)
    setOrders(prev => prev.filter(o => o.id !== orderId))
    onRefresh?.()
    // AI prevod razloga odbijanja (fire-and-forget) — gost vidi razlog na svom jeziku.
    if (message && restaurantId) {
      translateContent(restaurantId, orderRejectionFields(orderId, message)).catch(() => {})
    }
  }

  const resolveRequest = async (reqId, response = null) => {
    await supabase.from('waiter_requests').update({ is_resolved: true, response }).eq('id', reqId)
    setRequests(prev => prev.filter(r => r.id !== reqId))
  }

  if (loading) return <div className={s.loadingInline}>{t('loading')}</div>

  // ── Zahtjevi tab ─────────────────────────────────────────────────
  if (activeTab === 'requests') return (
    <div>
      {requests.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🔔</div>
          <div className={s.emptyText}>{t('noRequests')}</div>
        </div>
      ) : requests.map(req => {
        const isOnline = req.table_number === 'Online' || !req.table_number
        return (
          <div key={req.id} className={s.reqCard}>
            <div className={s.reqCardHeader}>
              <div className={s.reqCardMeta}>
                <div className={s.reqSource}>
                  <span className={s.sourceIcon}>{isOnline ? '🌐' : '🪑'}</span>
                  {isOnline ? t('online') : `${t('table')} ${req.table_number}`}
                </div>
                <div className={s.reqRef}>#{req.id.slice(-6).toUpperCase()}</div>
              </div>
              <div className={s.reqTimeStamp}>
                {new Date(req.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className={s.reqTypeText}>{req.request_type}</div>

            <div className={s.quickRespRow}>
              {QUICK_RESPONSE_KEYS.map(k => {
                const resp = t(k)
                return (
                  <button key={k} className={s.quickRespBtn}
                    onClick={() => resolveRequest(req.id, resp)}>
                    {resp}
                  </button>
                )
              })}
            </div>

            <button className={s.reqResolveBtn} onClick={() => resolveRequest(req.id, null)}>
              ✓ {t('resolved')}
            </button>
          </div>
        )
      })}
    </div>
  )

  // ── Narudžbe tab ─────────────────────────────────────────────────
  if (newMode) return <NewOrderView restaurant={restaurant} onDone={() => { setNewMode(false); load() }} />

  return (
    <div>
      <button className={s.newOrderBtn} onClick={() => setNewMode(true)}>+ {t('newOrder')}</button>
      {orders.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>🍽️</div>
          <div className={s.emptyText}>{t('noOrders')}</div>
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
                  {isOnline ? t('online') : `${t('table')} ${order.table_number}`}
                </div>
                <div className={s.orderRef}>#{order.id.slice(-6).toUpperCase()}</div>
              </div>
              <span className={s.statusBadge} style={{ background: st.bg, color: st.color }}>
                {t(st.labelKey)}
              </span>
            </div>

            <div className={s.orderItems}>
              {(order.order_items || []).map((item, i) => (
                <div key={i} className={s.orderItemRow}>
                  <span className={s.orderItemQty}>{item.quantity}×</span>
                  <span className={s.orderItemName}>{item.name}</span>
                  <span className={s.orderItemPrice}>
                    {money(parseFloat(item.price) * item.quantity)}
                  </span>
                </div>
              ))}
              {order.total && (
                <div className={s.orderTotalRow}>
                  <span>{t('total')}</span>
                  <span>{money(order.total)}</span>
                </div>
              )}
            </div>

            {order.note && (
              <div className={s.orderNote}>
                <span className={s.orderNoteIcon}>💬</span>
                {order.note}
              </div>
            )}

            <div className={s.orderActionsCol}>
              {order.status === 'preparing' && (order.kitchen_status || order.bar_status) ? (
                <div className={s.preparingInfo}>
                  {order.kitchen_status === 'preparing' && <span>🧑‍🍳 {t('kitchenPreparing')}</span>}
                  {order.bar_status     === 'preparing' && <span>🍷 {t('barPreparing')}</span>}
                  {order.kitchen_status === 'ready'     && <span className={s.stationDone}>🧑‍🍳 {t('kitchenReady')}</span>}
                  {order.bar_status     === 'ready'     && <span className={s.stationDone}>🍷 {t('barReady')}</span>}
                </div>
              ) : action && (
                <button className={s[action.cls]} onClick={() => updateOrderStatus(order.id, action.next)}>
                  {t(action.labelKey)}
                </button>
              )}
              {order.status === 'served' && hotelEnabled && !roomChargeMap[order.id] && (
                <button className={s.roomChargeBtn} onClick={() => openRoomCharge(order.id)}>
                  🏨 {t('chargeToRoom')}
                </button>
              )}
              {order.status === 'served' && fiscalEnabled && (
                <button className={s.invoiceBtn} disabled={invoicing === order.id} onClick={() => printOrderInvoice(order.id)}>
                  🧾 {invoicing === order.id ? '…' : t('spwInvoice')}
                </button>
              )}
              {['pending', 'received'].includes(order.status) && (
                <div className={s.rejectWrap}>
                  <div className={s.rejectLabel}>{t('rejectWithMsg')}</div>
                  <div className={s.rejectMessages}>
                    {rejectMessages.map(msg => (
                      <button key={msg} className={s.rejectMsgBtn}
                        onClick={() => rejectOrder(order.id, msg)}>
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {order.status === 'served' && roomChargeMap[order.id] && (
              <div className={s.roomChargePanel}>
                <div className={s.roomChargePanelTitle}>🏨 {t('roomNumber')}</div>
                <div className={s.roomChargeRow}>
                  <input
                    className={s.roomChargeInput}
                    placeholder={t('phRoomExample')}
                    value={roomChargeMap[order.id].roomNum}
                    onChange={e => setRoomChargeMap(p => ({ ...p, [order.id]: { ...p[order.id], roomNum: e.target.value } }))}
                    onKeyDown={e => e.key === 'Enter' && chargeToRoom(order)}
                    autoFocus
                  />
                  <button
                    className={s.roomChargeConfirm}
                    onClick={() => chargeToRoom(order)}
                    disabled={roomChargeMap[order.id].loading}
                  >
                    {roomChargeMap[order.id].loading ? '...' : t('confirm')}
                  </button>
                  <button className={s.roomChargeCancel} onClick={() => cancelRoomCharge(order.id)}>
                    {t('cancel')}
                  </button>
                </div>
                {roomChargeMap[order.id].error && (
                  <div className={s.roomChargeError}>{roomChargeMap[order.id].error}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
