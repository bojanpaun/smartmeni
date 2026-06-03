import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import styles from './KitchenDashboard.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

function startOfDay(dateStr) { return `${dateStr}T00:00:00.000Z` }
function endOfDay(dateStr) { return `${dateStr}T23:59:59.999Z` }

// mode: 'kitchen' | 'bar'
export default function KitchenDashboard({ mode = 'kitchen' }) {
  const { restaurant } = usePlatform()
  const [orders, setOrders] = useState([])
  const [barCatIds, setBarCatIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [from, setFrom] = useState(DATE_TODAY)
  const [to, setTo] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')

  const isDone = statusFilter === 'done'
  const isBar  = mode === 'bar'
  const { refreshCounts } = useAdminBadgeRefresh()

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
    const handleChange = () => { loadOrders(); refreshCounts() }
    const channel = supabase
      .channel(`kitchen-${mode}-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, handleChange)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [restaurant, statusFilter, from, to])

  const loadOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurant.id)

    if (isDone) {
      query = query
        .in('status', ['served', 'closed'])
        .order('created_at', { ascending: false })
      if (from) query = query.gte('created_at', startOfDay(from))
      if (to)   query = query.lte('created_at', endOfDay(to))
    } else {
      const stationCol = isBar ? 'bar_status' : 'kitchen_status'
      const stationVal = statusFilter === 'active' ? 'preparing' : 'ready'
      query = query
        .eq(stationCol, stationVal)
        .not('status', 'in', '("served","closed")')
        .order('created_at', { ascending: true })
    }

    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  const markReady = async (orderId) => {
    const stationCol = isBar ? 'bar_status' : 'kitchen_status'

    await supabase.from('orders')
      .update({ [stationCol]: 'ready' })
      .eq('id', orderId)

    const { data: current } = await supabase.from('orders')
      .select('kitchen_status, bar_status')
      .eq('id', orderId)
      .maybeSingle()

    if (current) {
      const kitchenDone = !current.kitchen_status || current.kitchen_status === 'ready'
      const barDone     = !current.bar_status     || current.bar_status     === 'ready'
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

  const visibleOrders = useMemo(() => {
    const q = search.toLowerCase()
    return orders
      .map(o => ({ ...o, order_items: filterItems(o.order_items) }))
      .filter(o => o.order_items.length > 0)
      .filter(o => {
        if (!q) return true
        const tableMatch = String(o.table_number || '').toLowerCase().includes(q)
        const itemMatch = (o.order_items || []).some(i => (i.name || '').toLowerCase().includes(q))
        return tableMatch || itemMatch
      })
  }, [orders, barCatIds, statusFilter, search])

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

        <DateNav
          from={from}
          to={to}
          search={search}
          onChange={(f, t) => { setFrom(f); setTo(t) }}
          onSearch={setSearch}
          showFuture={false}
          showMonth={true}
          allowAll={true}
          placeholder="Pretraži sto ili stavku..."
        />

        {isDone && visibleOrders.length > 0 && (
          <div className={styles.periodBar}>
            <div className={styles.doneSummary}>
              <span>{visibleOrders.length} narudžbi</span>
              <span>·</span>
              <span>{totalItems} stavki</span>
            </div>
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
