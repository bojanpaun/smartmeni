import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import AdminLayout from '../../../layouts/AdminLayout'
import styles from './KitchenDashboard.module.css'

export default function KitchenDashboard() {
  const { restaurant } = usePlatform()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    if (!restaurant) return
    loadOrders()

    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => loadOrders())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [restaurant, filter])

  const loadOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: true })

    if (filter === 'active') {
      query = query.in('status', ['received', 'preparing'])
    } else if (filter === 'ready') {
      query = query.eq('status', 'ready')
    } else {
      query = query.in('status', ['served', 'closed'])
    }

    const { data } = await query
    setOrders(data || [])
    setLoading(false)
  }

  const startPreparing = async (orderId) => {
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId)
  }

  const markReady = async (orderId) => {
    await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)
  }

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}min`
    return `${Math.floor(diff / 3600)}h`
  }

  const isUrgent = (dateStr) => {
    return (Date.now() - new Date(dateStr)) > 10 * 60 * 1000
  }

  if (loading) return <AdminLayout><div className={styles.loading}>Učitavanje...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Kuhinja</div>
        <div className={styles.liveBadge}>
          <div className={styles.liveDot}></div>
          Realtime
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === 'active' ? styles.filterActive : ''}`}
            onClick={() => setFilter('active')}
          >
            Aktivne ({orders.filter ? orders.length : 0})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'ready' ? styles.filterActive : ''}`}
            onClick={() => setFilter('ready')}
          >
            Gotove
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'done' ? styles.filterActive : ''}`}
            onClick={() => setFilter('done')}
          >
            Završene
          </button>
        </div>

        {orders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              {filter === 'active' ? '✓' : '🍳'}
            </div>
            <div className={styles.emptyText}>
              {filter === 'active' ? 'Sve narudžbe su odrađene!' : 'Nema narudžbi'}
            </div>
          </div>
        ) : (
          <div className={styles.tickets}>
            {orders.map(order => (
              <div
                key={order.id}
                className={`${styles.ticket} ${order.status === 'received' ? styles.ticketNew : ''} ${isUrgent(order.created_at) && order.status !== 'ready' ? styles.ticketUrgent : ''}`}
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
                    <button
                      className={`${styles.ticketBtn} ${styles.ticketBtnPrimary}`}
                      onClick={() => startPreparing(order.id)}
                    >
                      Počni pripremu
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      className={`${styles.ticketBtn} ${styles.ticketBtnSuccess}`}
                      onClick={() => markReady(order.id)}
                    >
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
    </AdminLayout>
  )
}
