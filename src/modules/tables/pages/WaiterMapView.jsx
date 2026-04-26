// ▶ Zamijeniti: src/modules/tables/pages/WaiterMapView.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './WaiterMapView.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function WaiterMapView() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [waiterRequests, setWaiterRequests] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState(null)

  useEffect(() => {
    if (!restaurant) return
    loadAll()
    const unsub = subscribeRealtime()
    return () => unsub()
  }, [restaurant])

  const loadAll = async () => {
    const [{ data: tbls }, { data: ords }, { data: reqs }, { data: res }] = await Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', restaurant.id).order('number'),
      supabase.from('orders').select('*, order_items(*, menu_items(name, price))')
        .eq('restaurant_id', restaurant.id)
        .in('status', ['received', 'preparing', 'ready']),
      supabase.from('waiter_requests').select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_resolved', false),
      supabase.from('reservations').select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('date', today())
        .eq('status', 'confirmed')
        .order('time'),
    ])
    setTables(tbls || [])
    setOrders(ords || [])
    setWaiterRequests(reqs || [])
    setReservations(res || [])
    setLoading(false)
  }

  const subscribeRealtime = () => {
    const channel = supabase.channel('waiter-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  // ── Helpers ──────────────────────────────────────────────────
  const getTableOrders = (tableNumber) =>
    orders.filter(o => o.table_number === String(tableNumber))

  const getTableRequest = (tableNumber) =>
    waiterRequests.find(r => r.table_number === String(tableNumber))

  // Vraća SVE rezervacije za sto (može ih biti više u različitim terminima)
  const getTableReservations = (table) =>
    reservations.filter(r => r.table_id === table.id || r.table_number === table.number)
      .sort((a, b) => a.time.localeCompare(b.time))

  const getTableStatus = (table) => {
    if (getTableRequest(table.number)) return 'calling'
    if (getTableOrders(table.number).length > 0) return 'occupied'
    if (getTableReservations(table).length > 0) return 'reserved'
    return 'free'
  }

  const getTableTotal = (tableNumber) =>
    getTableOrders(tableNumber).reduce((s, o) => s + (parseFloat(o.total) || 0), 0)

  const resolveRequest = async (requestId) => {
    await supabase.from('waiter_requests')
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
    setWaiterRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const markOrderReady = async (orderId) => {
    await supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)
  }

  const closeTable = async (tableNumber) => {
    if (!confirm(`Zatvoriti sto ${tableNumber}? Sve aktivne narudžbe će biti označene kao završene.`)) return
    for (const o of getTableOrders(tableNumber)) {
      await supabase.from('orders').update({ status: 'served' }).eq('id', o.id)
    }
    const req = getTableRequest(tableNumber)
    if (req) await resolveRequest(req.id)
    loadAll()
    setSelectedTable(null)
  }

  if (loading) return <div className={styles.loading}>Učitavanje mape...</div>

  const selectedTableData = tables.find(t => t.id === selectedTable)
  const selectedOrders = selectedTableData ? getTableOrders(selectedTableData.number) : []
  const selectedRequest = selectedTableData ? getTableRequest(selectedTableData.number) : null
  const selectedReservations = selectedTableData ? getTableReservations(selectedTableData) : []
  const selectedTotal = selectedTableData ? getTableTotal(selectedTableData.number) : 0

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={gsStyles.title} style={{ margin: 0 }}>Pregled stolova</h1>
          <div className={styles.headerBadges}>
            {tables.filter(t => getTableStatus(t) === 'calling').length > 0 && (
              <span className={styles.alertBadge}>
                🔔 {tables.filter(t => getTableStatus(t) === 'calling').length} zove konobara
              </span>
            )}
            {reservations.length > 0 && (
              <span className={styles.reservedBadge}>
                📅 {reservations.length} {reservations.length === 1 ? 'rezervacija' : 'rezervacija'} danas
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnEdit} onClick={() => navigate('/admin/tables')}>
            ✏️ Uredi mapu
          </button>
          <button className={styles.btnReservations} onClick={() => navigate('/admin/reservations')}>
            📅 Rezervacije
          </button>
        </div>
      </div>

      <div className={styles.layout}>

        {/* Mapa */}
        <div className={styles.mapWrap}>
          <div className={styles.mapCanvas}>
            <div className={styles.canvasGrid} />

            {tables.map(table => {
              const status = getTableStatus(table)
              const total = getTableTotal(table.number)
              const tableReservations = getTableReservations(table)

              return (
                <div
                  key={table.id}
                  className={`${styles.tableEl} ${styles[`status-${status}`]} ${selectedTable === table.id ? styles.tableElSelected : ''}`}
                  style={{
                    left: table.x,
                    top: table.y,
                    width: table.width,
                    height: table.height,
                    borderRadius: table.shape === 'circle' ? '50%' : 8,
                  }}
                  onClick={() => setSelectedTable(table.id === selectedTable ? null : table.id)}
                >
                  {status === 'calling' && <div className={styles.pulseRing} />}

                  {/* Badge za rezervacije — prikazuje sve termine */}
                  {tableReservations.length > 0 && (
                    <div className={styles.reservationBadge}>
                      📅 {tableReservations.map(r => r.time?.slice(0, 5)).join(', ')}
                      {tableReservations.length > 1 && (
                        <span className={styles.reservationCount}>{tableReservations.length}</span>
                      )}
                    </div>
                  )}

                  <div className={styles.tableLabel}>{table.label || `Sto ${table.number}`}</div>

                  {status === 'occupied' && <div className={styles.tableTotal}>€{total.toFixed(2)}</div>}
                  {status === 'calling' && <div className={styles.tableAlert}>🔔</div>}
                  {status === 'reserved' && (
                    <div className={styles.tableReservedLabel}>
                      {tableReservations[0]?.guest_name?.split(' ')[0]}
                      {tableReservations.length > 1 && ` +${tableReservations.length - 1}`}
                    </div>
                  )}
                  {status === 'free' && <div className={styles.tableFreeLabel}>slobodan</div>}
                </div>
              )
            })}

            {tables.length === 0 && (
              <div className={styles.emptyMap}>
                <div>🗺️</div>
                <div>Nema stolova na mapi</div>
                <button className={styles.btnEdit} onClick={() => navigate('/admin/tables')}>
                  Dodaj stolove →
                </button>
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className={styles.legend}>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotFree}`} /> Slobodan</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotOccupied}`} /> Zauzet</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotReserved}`} /> Rezervisan</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotCalling}`} /> Zove konobara</div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedTableData && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailTitle}>{selectedTableData.label || `Sto ${selectedTableData.number}`}</div>
                <div className={styles.detailSub}>{selectedTableData.seats} mjesta</div>
              </div>
              <button className={styles.detailClose} onClick={() => setSelectedTable(null)}>✕</button>
            </div>

            {/* Sve rezervacije za ovaj sto */}
            {selectedReservations.length > 0 && (
              <div>
                <div className={styles.reservationsTitle}>
                  Rezervacije danas ({selectedReservations.length})
                </div>
                {selectedReservations.map((res, i) => (
                  <div key={res.id} className={styles.reservationCard}>
                    <div className={styles.reservationTime}>{res.time?.slice(0, 5)}</div>
                    <div className={styles.reservationBody}>
                      <div className={styles.reservationGuest}>{res.guest_name}</div>
                      <div className={styles.reservationMeta}>
                        {res.guests_count} {res.guests_count === 1 ? 'gost' : 'gosta'}
                        {res.guest_phone && ` · ${res.guest_phone}`}
                      </div>
                      {res.note && <div className={styles.reservationNote}>{res.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zahtjev konobara */}
            {selectedRequest && (
              <div className={styles.requestCard}>
                <div className={styles.requestIcon}>🔔</div>
                <div className={styles.requestBody}>
                  <div className={styles.requestType}>{selectedRequest.request_type}</div>
                  <div className={styles.requestTime}>
                    {new Date(selectedRequest.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button className={styles.requestResolve} onClick={() => resolveRequest(selectedRequest.id)}>
                  Riješeno
                </button>
              </div>
            )}

            {/* Narudžbe */}
            {selectedOrders.length > 0 && (
              <>
                <div className={styles.ordersTitle}>Aktivne narudžbe</div>
                {selectedOrders.map(order => (
                  <div key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <span className={`${styles.orderStatus} ${styles[`orderStatus-${order.status}`]}`}>
                        {order.status === 'received' ? 'Primljeno' : order.status === 'preparing' ? 'Priprema se' : 'Spremo'}
                      </span>
                      <span className={styles.orderTime}>
                        {new Date(order.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {order.note && <div className={styles.orderNote}>{order.note}</div>}
                    <div className={styles.orderTotal}>€{parseFloat(order.total).toFixed(2)}</div>
                    {order.status !== 'ready' && (
                      <button className={styles.btnReady} onClick={() => markOrderReady(order.id)}>
                        Označi kao spremo
                      </button>
                    )}
                  </div>
                ))}
                <div className={styles.totalRow}>
                  <span>Ukupno za sto</span>
                  <span className={styles.totalAmount}>€{selectedTotal.toFixed(2)}</span>
                </div>
                <button className={styles.btnClose} onClick={() => closeTable(selectedTableData.number)}>
                  Zatvori sto
                </button>
              </>
            )}

            {selectedOrders.length === 0 && !selectedRequest && selectedReservations.length === 0 && (
              <div className={styles.noOrders}>Sto je slobodan.</div>
            )}
            {selectedOrders.length === 0 && !selectedRequest && selectedReservations.length > 0 && (
              <div className={styles.noOrders}>Gosti još nijesu stigli.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
