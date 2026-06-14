import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import styles from './WaiterMapView.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function WaiterMapView() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const money = useMoney()
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

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
    const channel = supabase.channel(`waiter-map-${restaurant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',          filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests', filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables',          filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations',    filter: `restaurant_id=eq.${restaurant.id}` }, () => loadAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  const getTableOrders      = (n)     => orders.filter(o => o.table_number === String(n))
  const getTableRequest     = (n)     => waiterRequests.find(r => r.table_number === String(n))
  const getTableReservations = (t)   => reservations.filter(r => r.table_id === t.id || r.table_number === t.number).sort((a, b) => a.time.localeCompare(b.time))
  const getTableTotal       = (n)     => getTableOrders(n).reduce((s, o) => s + (parseFloat(o.total) || 0), 0)

  const getTableStatus = (table) => {
    if (getTableRequest(table.number)) return 'calling'
    if (getTableOrders(table.number).length > 0) return 'occupied'
    if (getTableReservations(table).length > 0) return 'reserved'
    return 'free'
  }

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
    if (!confirm(t('wmvCloseConfirm', { n: tableNumber }))) return
    for (const o of getTableOrders(tableNumber)) {
      await supabase.from('orders').update({ status: 'served' }).eq('id', o.id)
    }
    const req = getTableRequest(tableNumber)
    if (req) await resolveRequest(req.id)
    loadAll()
    setSelectedTable(null)
  }

  if (loading) return <div className={styles.loading}>{t('wmvLoading')}</div>

  const selectedTableData   = tables.find(tb => tb.id === selectedTable)
  const selectedOrders      = selectedTableData ? getTableOrders(selectedTableData.number) : []
  const selectedRequest     = selectedTableData ? getTableRequest(selectedTableData.number) : null
  const selectedReservations = selectedTableData ? getTableReservations(selectedTableData) : []
  const selectedTotal       = selectedTableData ? getTableTotal(selectedTableData.number) : 0
  const callingTables       = tables.filter(tb => getTableStatus(tb) === 'calling')

  // Zajednički sadržaj detail panela i bottom sheeta
  const detailContent = selectedTableData ? (
    <>
      {selectedReservations.length > 0 && (
        <div>
          <div className={styles.reservationsTitle}>
            {t('wmvResToday', { count: selectedReservations.length })}
          </div>
          {selectedReservations.map(res => (
            <div key={res.id} className={styles.reservationCard}>
              <div className={styles.reservationTime}>{res.time?.slice(0, 5)}</div>
              <div className={styles.reservationBody}>
                <div className={styles.reservationGuest}>{res.guest_name}</div>
                <div className={styles.reservationMeta}>
                  {res.guests_count} {res.guests_count === 1 ? t('tblGuestOne') : t('tblGuestOther')}
                  {res.guest_phone && ` · ${res.guest_phone}`}
                </div>
                {res.note && <div className={styles.reservationNote}>{res.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRequest && (
        <div className={styles.requestCard}>
          <div className={styles.requestIcon}>🔔</div>
          <div className={styles.requestBody}>
            <div className={styles.requestType}>{selectedRequest.request_type}</div>
            <div className={styles.requestTime}>
              {new Date(selectedRequest.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button className={styles.requestResolve} onClick={() => resolveRequest(selectedRequest.id)}>
            {t('wmvResolved')}
          </button>
        </div>
      )}

      {selectedOrders.length > 0 && (
        <>
          <div className={styles.ordersTitle}>{t('wmvActiveOrders')}</div>
          {selectedOrders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <span className={`${styles.orderStatus} ${styles[`orderStatus-${order.status}`]}`}>
                  {order.status === 'received' ? t('wmvOrdReceived') : order.status === 'preparing' ? t('wmvOrdPreparing') : t('wmvOrdReady')}
                </span>
                <span className={styles.orderTime}>
                  {new Date(order.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {order.note && <div className={styles.orderNote}>{order.note}</div>}
              <div className={styles.orderTotal}>{money(order.total)}</div>
              {order.status !== 'ready' && (
                <button className={styles.btnReady} onClick={() => markOrderReady(order.id)}>
                  {t('wmvMarkReady')}
                </button>
              )}
            </div>
          ))}
          <div className={styles.totalRow}>
            <span>{t('wmvTotalForTable')}</span>
            <span className={styles.totalAmount}>{money(selectedTotal)}</span>
          </div>
          <button className={styles.btnClose} onClick={() => closeTable(selectedTableData.number)}>
            {t('wmvCloseTable')}
          </button>
        </>
      )}

      {selectedOrders.length === 0 && !selectedRequest && selectedReservations.length === 0 && (
        <div className={styles.noOrders}>{t('wmvTableFree')}</div>
      )}
      {selectedOrders.length === 0 && !selectedRequest && selectedReservations.length > 0 && (
        <div className={styles.noOrders}>{t('wmvGuestsNotArrived')}</div>
      )}
    </>
  ) : null

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={gsStyles.title} style={{ margin: 0 }}>{t('wmvTitle')}</h1>
          <div className={styles.headerBadges}>
            {callingTables.length > 0 && (
              <span className={styles.alertBadge}>
                🔔 {t('wmvCallsWaiterBadge', { count: callingTables.length })}
              </span>
            )}
            {reservations.length > 0 && (
              <span className={styles.reservedBadge}>
                📅 {t('wmvResTodayBadge', { count: reservations.length })}
              </span>
            )}
          </div>
        </div>
        {/* Skriveno na mobilnom */}
        <div className={styles.headerActions}>
          <button className={styles.btnEdit} onClick={() => navigate('/admin/tables')}>
            ✏️ {t('wmvEditMap')}
          </button>
          <button className={styles.btnReservations} onClick={() => navigate('/admin/reservations')}>
            📅 {t('wmvReservations')}
          </button>
        </div>
      </div>

      {/* Calling bar — samo mobilni, vidljiv kada neko zove */}
      {callingTables.length > 0 && (
        <div className={styles.callingBar}>
          {callingTables.map(tb => {
            const req = getTableRequest(tb.number)
            return (
              <div key={tb.id} className={styles.callingBarItem}>
                <span>🔔 {t('wmvTableCalls', { table: tb.label || `${t('anaTable')} ${tb.number}` })}</span>
                {req && (
                  <button className={styles.callingBarResolve} onClick={() => resolveRequest(req.id)}>
                    {t('wmvResolved')} ✓
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Desktop: floor plan + detail panel ── */}
      <div className={styles.layout}>
        <div className={styles.mapWrap}>
          <div className={styles.mapCanvas}>
            <div className={styles.canvasGrid} />

            {tables.map(table => {
              const status = getTableStatus(table)
              const total  = getTableTotal(table.number)
              const tableReservations = getTableReservations(table)

              return (
                <div
                  key={table.id}
                  className={`${styles.tableEl} ${styles[`status-${status}`]} ${selectedTable === table.id ? styles.tableElSelected : ''}`}
                  style={{
                    left: table.x, top: table.y,
                    width: table.width, height: table.height,
                    borderRadius: table.shape === 'circle' ? '50%' : 8,
                  }}
                  onClick={() => setSelectedTable(table.id === selectedTable ? null : table.id)}
                >
                  {status === 'calling' && <div className={styles.pulseRing} />}

                  {tableReservations.length > 0 && (
                    <div className={styles.reservationBadge}>
                      📅 {tableReservations.map(r => r.time?.slice(0, 5)).join(', ')}
                      {tableReservations.length > 1 && (
                        <span className={styles.reservationCount}>{tableReservations.length}</span>
                      )}
                    </div>
                  )}

                  <div className={styles.tableLabel}>{table.label || `${t('anaTable')} ${table.number}`}</div>
                  {status === 'occupied' && <div className={styles.tableTotal}>{money(total)}</div>}
                  {status === 'calling'  && <div className={styles.tableAlert}>🔔</div>}
                  {status === 'reserved' && (
                    <div className={styles.tableReservedLabel}>
                      {tableReservations[0]?.guest_name?.split(' ')[0]}
                      {tableReservations.length > 1 && ` +${tableReservations.length - 1}`}
                    </div>
                  )}
                  {status === 'free' && <div className={styles.tableFreeLabel}>{t('tblFreeLower')}</div>}
                </div>
              )
            })}

            {tables.length === 0 && (
              <div className={styles.emptyMap}>
                <div>🗺️</div>
                <div>{t('wmvNoTablesMap')}</div>
                <button className={styles.btnEdit} onClick={() => navigate('/admin/tables')}>
                  {t('wmvAddTables')} →
                </button>
              </div>
            )}
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotFree}`} /> {t('tblFree')}</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotOccupied}`} /> {t('tblOccupied')}</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotReserved}`} /> {t('tblReserved')}</div>
            <div className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotCalling}`} /> {t('tblCalling')}</div>
          </div>
        </div>

        {selectedTableData && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailTitle}>{selectedTableData.label || `${t('anaTable')} ${selectedTableData.number}`}</div>
                <div className={styles.detailSub}>{selectedTableData.seats} {t('tblSeats')}</div>
              </div>
              <button className={styles.detailClose} onClick={() => setSelectedTable(null)}>✕</button>
            </div>
            {detailContent}
          </div>
        )}
      </div>

      {/* ── Mobile: card grid ── */}
      <div className={styles.mobileGrid}>
        {tables.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem 1rem', color: 'var(--c-text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🗺️</div>
            <div>{t('wmvNoTables')}</div>
          </div>
        )}
        {tables.map(table => {
          const status = getTableStatus(table)
          const total  = getTableTotal(table.number)
          const res    = getTableReservations(table)
          return (
            <div
              key={table.id}
              className={`${styles.mobileCard} ${styles[`mobileCard-${status}`]} ${selectedTable === table.id ? styles.mobileCardSelected : ''}`}
              onClick={() => setSelectedTable(table.id === selectedTable ? null : table.id)}
            >
              {status === 'calling' && <div className={styles.mobilePulse} />}
              <div className={styles.mobileCardName}>{table.label || `${t('anaTable')} ${table.number}`}</div>
              <div className={styles.mobileCardInfo}>
                {status === 'occupied' && <span className={styles.mobileCardAmount}>{money(total)}</span>}
                {status === 'calling'  && <span className={styles.mobileCardCallIcon}>🔔</span>}
                {status === 'reserved' && <span className={styles.mobileCardResTime}>📅 {res[0]?.time?.slice(0, 5)}</span>}
                {status === 'free'     && <span className={styles.mobileCardFreeLabel}>{t('tblFreeLower')}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Mobile: bottom sheet ── */}
      <div className={`${styles.bottomSheet} ${selectedTable ? styles.bottomSheetOpen : ''}`}>
        <div className={styles.bottomSheetHandle} />
        {selectedTableData && (
          <>
            <div className={styles.bottomSheetHeader}>
              <div>
                <div className={styles.detailTitle}>{selectedTableData.label || `${t('anaTable')} ${selectedTableData.number}`}</div>
                <div className={styles.detailSub}>{selectedTableData.seats} {t('tblSeats')}</div>
              </div>
              <button className={styles.detailClose} onClick={() => setSelectedTable(null)}>✕</button>
            </div>
            {detailContent}
          </>
        )}
      </div>

      {/* Mobile backdrop */}
      {selectedTable && <div className={styles.backdrop} onClick={() => setSelectedTable(null)} />}
    </div>
  )
}
