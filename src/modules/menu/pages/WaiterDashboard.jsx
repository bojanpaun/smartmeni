import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import AdminLayout from '../../../layouts/AdminLayout'
import styles from './WaiterDashboard.module.css'

const STATUS_CONFIG = {
  received:  { label: 'Primljeno',   color: '#1D9E75', bg: '#E1F5EE' },
  preparing: { label: 'U pripremi',  color: '#BA7517', bg: '#FAEEDA' },
  ready:     { label: 'Gotovo',      color: '#534AB7', bg: '#EEEDFE' },
  served:    { label: 'Servirano',   color: '#888780', bg: '#F1EFE8' },
  closed:    { label: 'Zatvoreno',   color: '#888780', bg: '#F1EFE8' },
}

export default function WaiterDashboard() {
  const { restaurant } = usePlatform()
  const [orders, setOrders] = useState([])
  const [waiterReqs, setWaiterReqs] = useState([])
  const [activeTab, setActiveTab] = useState('orders')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    loadData()
    setupRealtime()
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
        .not('status', 'eq', 'done')
        .order('created_at', { ascending: false }),
    ])
    setOrders(o || [])
    setWaiterReqs(w || [])
    setLoading(false)
  }

  const setupRealtime = () => {
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
  }

  const updateOrderStatus = async (orderId, status) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status } : o
    ).filter(o => o.status !== 'closed'))
  }

  const resolveWaiterReq = async (id) => {
    await supabase.from('waiter_requests').update({ status: 'done' }).eq('id', id)
    setWaiterReqs(prev => prev.filter(r => r.id !== id))
  }

  const NEXT_STATUS = {
    received: 'preparing',
    preparing: 'ready',
    ready: 'served',
    served: 'closed',
  }

  const NEXT_LABEL = {
    received: 'Prihvati narudžbu',
    preparing: 'Označi kao gotovo',
    ready: 'Serviraj gostu',
    served: 'Zatvori narudžbu',
  }

  const newOrdersCount = orders.filter(o => o.status === 'received').length
  const newReqsCount = waiterReqs.filter(r => r.status === 'new').length

  if (loading) return <AdminLayout><div className={styles.loading}>Učitavanje...</div></AdminLayout>

  return (
    <AdminLayout>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Narudžbe i zahtjevi</div>
        <div className={styles.liveBadge}>
          <div className={styles.liveDot}></div>
          Realtime
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'orders' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Narudžbe
            {newOrdersCount > 0 && <span className={styles.badge}>{newOrdersCount}</span>}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'waiter' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('waiter')}
          >
            Pozivi konobara
            {newReqsCount > 0 && <span className={styles.badge}>{newReqsCount}</span>}
          </button>
        </div>

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

                {NEXT_STATUS[order.status] && (
                  <button
                    className={styles.actionBtn}
                    style={{ background: restaurant?.color || '#0d7a52' }}
                    onClick={() => updateOrderStatus(order.id, NEXT_STATUS[order.status])}
                  >
                    {NEXT_LABEL[order.status]}
                  </button>
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
              <div key={req.id} className={`${styles.reqCard} ${req.status === 'new' ? styles.reqNew : ''}`}>
                <div className={styles.reqHeader}>
                  <div className={styles.reqTable}>Sto {req.table_number}</div>
                  <div className={styles.reqTime}>
                    {new Date(req.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={styles.reqType}>{req.request_type}</div>
                <button className={styles.resolveBtn} onClick={() => resolveWaiterReq(req.id)}>
                  Završeno ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
