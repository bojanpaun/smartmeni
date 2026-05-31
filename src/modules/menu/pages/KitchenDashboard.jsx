import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './KitchenDashboard.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

function toDateStr(d) { return d.toISOString().slice(0, 10) }
function startOfDay(dateStr) { return `${dateStr}T00:00:00.000Z` }
function endOfDay(dateStr) { return `${dateStr}T23:59:59.999Z` }

const PERIOD_OPTIONS = [
  { key: 'today',     label: 'Danas' },
  { key: 'yesterday', label: 'Juče' },
  { key: '7days',     label: '7 dana' },
  { key: '30days',    label: '30 dana' },
  { key: 'custom',    label: 'Period' },
]

function getPeriodRange(key, customFrom, customTo) {
  const now = new Date()
  if (key === 'today')     return { from: TODAY, to: TODAY }
  if (key === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const s = toDateStr(y); return { from: s, to: s }
  }
  if (key === '7days')  { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: toDateStr(f), to: TODAY } }
  if (key === '30days') { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: toDateStr(f), to: TODAY } }
  return { from: customFrom || TODAY, to: customTo || TODAY }
}

// mode: 'kitchen' | 'bar'
export default function KitchenDashboard({ mode = 'kitchen' }) {
  const { restaurant } = usePlatform()
  const [orders, setOrders] = useState([])
  const [barCatIds, setBarCatIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState(TODAY)
  const [customTo, setCustomTo] = useState(TODAY)

  const isDone = statusFilter === 'done'
  const isBar  = mode === 'bar'

  useEffect(() => {
    if (!restaurant) return
    supabase.from('categories').select('id, is_bar').eq('restaurant_id', restaurant.id)
      .then(({ data }) => {
        setBarCatIds(new Set((data || []).filter(c => c.is_bar).map(c => c.id)))
      })
  }, [restaurant])

  useEffect(() => {
    if (!restaurant) return
    loadOrders()
    if (isDone) return
    const channel = supabase
      .channel(`kitchen-${mode}-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => loadOrders())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [restaurant, statusFilter, period, customFrom, customTo])

  const loadOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurant.id)

    if (isDone) {
      const { from, to } = getPeriodRange(period, customFrom, customTo)
      query = query
        .in('status', ['served', 'closed'])
        .gte('created_at', startOfDay(from))
        .lte('created_at', endOfDay(to))
        .order('created_at', { ascending: false })
    } else {
      const stationCol = isBar ? 'bar_status' : 'kitchen_status'
      const stationVal = statusFilter === 'active' ? 'preparing' : 'ready'
      query = query.eq(stationCol, stationVal).order('created_at', { ascending: true })
    }

    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  const markReady = async (orderId) => {
    const stationCol = isBar ? 'bar_status' : 'kitchen_status'
    const { data: updated } = await supabase
      .from('orders')
      .update({ [stationCol]: 'ready' })
      .eq('id', orderId)
      .select('kitchen_status, bar_status')
      .single()

    if (updated) {
      const kitchenDone = !updated.kitchen_status || updated.kitchen_status === 'ready'
      const barDone     = !updated.bar_status     || updated.bar_status     === 'ready'
      if (kitchenDone && barDone) {
        await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)
      }
    }
  }

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    return `${Math.floor(diff / 3600)}h`
  }

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })

  const isUrgent = (dateStr) =>
    (Date.now() - new Date(dateStr)) > 10 * 60 * 1000

  const filterItems = (orderItems = []) =>
    orderItems.filter(item =>
      isBar ? barCatIds.has(item.category_id) : !barCatIds.has(item.category_id)
    )

  const visibleOrders = useMemo(() =>
    orders
      .map(o => ({ ...o, order_items: filterItems(o.order_items) }))
      .filter(o => o.order_items.length > 0)
  , [orders, barCatIds, statusFilter])

  const totalItems = useMemo(() =>
    visibleOrders.reduce((sum, o) => sum + (o.order_items?.length || 0), 0)
  , [visibleOrders])

  if (loading) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div>
      <div className={`${styles.topbar} ${isBar ? styles.topbarBar : ''}`}>
        <div className={styles.topbarTitle}>
          {isBar ? '🍷 Bar' : '🧑‍🍳 Kuhinja'}
        </div>
        {!isDone && (
          <div className={styles.liveBadge}>
            <div className={styles.liveDot}></div>
            Realtime
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'active' ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Aktivne{statusFilter === 'active' ? ` (${visibleOrders.length})` : ''}
          </button>
          <button
            className={`${styles.filterBtn} ${statusFilter === 'ready' ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter('ready')}
          >
            Gotove{statusFilter === 'ready' ? ` (${visibleOrders.length})` : ''}
          </button>
          <button
            className={`${styles.filterBtn} ${isDone ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter('done')}
          >
            Završene
          </button>
        </div>

        {isDone && (
          <div className={styles.periodBar}>
            <div className={styles.periodBtns}>
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.key}
                  className={`${styles.periodBtn} ${period === p.key ? styles.periodActive : ''}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className={styles.dateRange}>
                <input type="date" className={styles.dateInput} value={customFrom} max={customTo}
                  onChange={e => setCustomFrom(e.target.value)} />
                <span className={styles.dateSep}>—</span>
                <input type="date" className={styles.dateInput} value={customTo} min={customFrom} max={TODAY}
                  onChange={e => setCustomTo(e.target.value)} />
              </div>
            )}
            {visibleOrders.length > 0 && (
              <div className={styles.doneSummary}>
                <span>{visibleOrders.length} narudžbi</span>
                <span>·</span>
                <span>{totalItems} stavki</span>
              </div>
            )}
          </div>
        )}

        {visibleOrders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>{isBar ? '🍷' : statusFilter === 'done' ? '📋' : '✓'}</div>
            <div className={styles.emptyText}>
              {statusFilter === 'active' ? (isBar ? 'Nema aktivnih narudžbi za bar.' : 'Sve narudžbe su odrađene!') : 'Nema narudžbi'}
            </div>
          </div>
        ) : isDone ? (
          <div className={styles.doneTable}>
            <div className={styles.doneTableHead}>
              <span>Sto</span>
              <span>Stavke</span>
              <span>Datum</span>
              <span>Vrijeme</span>
              <span>Trajanje</span>
            </div>
            {visibleOrders.map(order => {
              const itemCount = order.order_items?.length || 0
              const names = (order.order_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ')
              const createdAt = new Date(order.created_at)
              const updatedAt = order.updated_at ? new Date(order.updated_at) : null
              const durationMin = updatedAt ? Math.round((updatedAt - createdAt) / 60000) : null
              return (
                <div key={order.id} className={styles.doneRow}>
                  <span className={styles.doneRowTable}>Sto {order.table_number || '—'}</span>
                  <span className={styles.doneRowItems} title={names}>
                    <span className={styles.doneItemCount}>{itemCount}</span>
                    <span className={styles.doneItemNames}>{names}</span>
                  </span>
                  <span className={styles.doneRowDate}>{formatDate(order.created_at)}</span>
                  <span className={styles.doneRowTime}>{formatTime(order.created_at)}</span>
                  <span className={styles.doneRowDur}>{durationMin !== null ? `${durationMin}min` : '—'}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.tickets}>
            {visibleOrders.map(order => (
              <div
                key={order.id}
                className={`${styles.ticket}
                  ${order.status === 'received' ? (isBar ? styles.ticketNewBar : styles.ticketNew) : ''}
                  ${isUrgent(order.created_at) && order.status !== 'ready' ? styles.ticketUrgent : ''}`}
              >
                <div className={styles.ticketHeader}>
                  <div className={styles.ticketTable}>Sto {order.table_number}</div>
                  <div className={styles.ticketMeta}>
                    <span className={`${styles.ticketStatus} ${styles[`status_${order.status}`]}`}>
                      {order.status === 'received' ? 'NOVO' : order.status === 'preparing' ? 'U PRIPREMI' : 'GOTOVO'}
                    </span>
                    <span className={`${styles.ticketTime} ${isUrgent(order.created_at) ? styles.urgent : ''}`}>
                      {timeAgo(order.created_at)}
                    </span>
                  </div>
                </div>

                <div className={styles.ticketItems}>
                  {(order.order_items || []).map(item => (
                    <div key={item.id} className={styles.ticketItem}>
                      <span className={styles.ticketQty}>{item.quantity}×</span>
                      <div className={styles.ticketItemBody}>
                        <span className={styles.ticketItemName}>{item.name}</span>
                        {item.note && (
                          <span className={styles.ticketItemNote}>⚠ {item.note}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.ticketActions}>
                  {order.status === 'received' && (
                    <div className={styles.ticketWaiting}>Čeka konobara...</div>
                  )}
                  {order.status === 'preparing' && (
                    <button className={`${styles.ticketBtn} ${styles.ticketBtnSuccess}`}
                      onClick={() => markReady(order.id)}>
                      Gotovo! ✓
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <div className={styles.ticketReady}>Čeka konobara...</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
