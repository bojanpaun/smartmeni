import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useMoney } from '../../../lib/useMoney'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import { useReservations } from '../hooks/useReservations'
import { supabase } from '../../../lib/supabase'
import { logAudit } from '../../../lib/auditLog'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import SortableHead from '../../../components/shared/SortableHead'
import { useSortable } from '../../../hooks/useSortable'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const REQ_STATUS = {
  pending:     { labelKey: 'htReqPending',    color: '#e67e22', bg: '#fff7ed' },
  in_progress: { labelKey: 'htReqInProgress', color: '#2563eb', bg: '#eff6ff' },
  resolved:    { labelKey: 'htReqResolved',   color: '#0d7a52', bg: '#ecfdf5' },
}

const REQ_CAT_ICON = {
  housekeeping: '🧹', linen: '🛏️', maintenance: '🔧',
  food: '🍽️', transport: '🚗', info: 'ℹ️', other: '📋',
}

export default function FrontDeskPage() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const money = useMoney()
  const { refreshCounts } = useAdminBadgeRefresh()
  const navigate = useNavigate()
  const [tab, setTab] = useState('checkin')
  const [from, setFrom] = useState(DATE_TODAY)
  const [to, setTo] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')
  const ciSort  = useSortable('check_out_date')
  const coSort  = useSortable('check_in_date')
  const reqSort = useSortable('created_at', 'desc')

  const { reservations: arrivals, loading: loadingArrivals, refetch: refetchArrivals } = useReservations(restaurant?.id, {
    status: 'confirmed', checkInFrom: from, checkInTo: to,
  })
  const { reservations: departures, loading: loadingDep, refetch: refetchDep } = useReservations(restaurant?.id, {
    status: 'checked_in', checkOutFrom: from, checkOutTo: to,
  })

  const [requests, setRequests] = useState([])
  const [loadingReq, setLoadingReq] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  const loadRequests = useCallback(async () => {
    if (!restaurant?.id) return
    setLoadingReq(true)
    const { data } = await supabase
      .from('guest_requests')
      .select('*, hotel_reservations(guest_name, rooms(room_number))')
      .eq('restaurant_id', restaurant.id)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoadingReq(false)
  }, [restaurant?.id])

  useEffect(() => {
    if (tab === 'requests') loadRequests()
  }, [tab, loadRequests])

  // Real-time subscription — guest_requests + hotel_reservations promjene
  useEffect(() => {
    if (!restaurant?.id) return
    const handleReqChange = () => { if (tab === 'requests') loadRequests(); refreshCounts() }
    const handleResChange = () => { refreshCounts() }
    const channel = supabase.channel(`fd-rt-${restaurant.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'guest_requests',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, handleReqChange)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hotel_reservations',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, handleResChange)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id, tab, loadRequests, refreshCounts])

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id)
    const patch = { status: newStatus }
    if (newStatus === 'resolved') patch.resolved_at = new Date().toISOString()
    await supabase.from('guest_requests').update(patch).eq('id', id)
    setUpdatingId(null)
    loadRequests()
  }

  const handleCheckIn = async (res) => {
    if (res.guest_id) {
      const { data: g } = await supabase.from('guests').select('status, first_name, last_name').eq('id', res.guest_id).single()
      if (g?.status === 'blacklist') {
        if (!window.confirm(t('htBlacklistWarn', { name: `${g.first_name} ${g.last_name}` }))) return
      }
    }
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_in',
      actual_check_in: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) return toast.error(t('htCheckinErr'))

    if (res.room_id) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
    }

    // Upiši room_charge za sve noći boravka (kreira folio ako fali). Tako je folio
    // pun od check-ina i poklapa se sa iznosom rezervacije. Noćni audit je idempotentan.
    await supabase.rpc('post_stay_room_charges', { p_reservation_id: res.id })

    toast.success(t('htCheckinSuccess', { name: res.guest_name }))
    logAudit({
      restaurantId: restaurant.id, action: 'reservation.checkin',
      entityType: 'hotel_reservation', entityId: res.id,
      summary: `Check-in: ${res.guest_name}`,
      metadata: { room: res.room_number ?? null },
    })
    supabase.functions.invoke('send-booking-email', {
      body: { reservation_id: res.id, type: 'checkin' },
    }).catch(() => {})
    refetchArrivals()
    refreshCounts()
  }

  const handleCheckOut = async (res) => {
    const nowIso = new Date().toISOString()
    const todayStr = nowIso.slice(0, 10)

    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_out',
      actual_check_out: nowIso,
    }).eq('id', res.id)
    if (error) return toast.error(t('htCheckoutErr'))

    if (res.room_id) {
      await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', res.room_id)
    }

    // Rani odlazak: ako politika hotela = 'stay', skini room_charge za neodsjedene
    // (buduće) noći. 'full' = zadrži ukupno rezervisano.
    if (todayStr < res.check_out_date && restaurant.early_departure_charge !== 'full') {
      const { data: folio } = await supabase.from('folios')
        .select('id').eq('reservation_id', res.id)
        .order('is_primary', { ascending: false }).order('created_at').limit(1).maybeSingle()
      if (folio?.id) {
        await supabase.from('folio_items').delete()
          .eq('folio_id', folio.id).eq('type', 'room_charge').gte('date', todayStr)
        await supabase.rpc('recalc_folio_total', { p_folio_id: folio.id })
      }
    }

    await supabase.from('folios').update({ status: 'closed', updated_at: nowIso })
      .eq('reservation_id', res.id)

    toast.success(t('htCheckoutSuccess', { name: res.guest_name }))
    logAudit({
      restaurantId: restaurant.id, action: 'reservation.checkout',
      entityType: 'hotel_reservation', entityId: res.id,
      summary: `Check-out: ${res.guest_name}`,
      metadata: { room: res.room_number ?? null, early_departure: todayStr < res.check_out_date },
    })
    supabase.functions.invoke('send-booking-email', {
      body: { reservation_id: res.id, type: 'checkout' },
    }).catch(() => {})
    refetchDep()
    refreshCounts()
  }

  const loading = loadingArrivals || loadingDep

  const pendingCount = requests.filter(r => r.status === 'pending').length

  // Client-side search filter
  const q = search.toLowerCase()
  const filteredArrivals = arrivals.filter(res => {
    if (!q) return true
    return (
      (res.guest_name || '').toLowerCase().includes(q) ||
      String(res.rooms?.room_number || '').toLowerCase().includes(q)
    )
  })
  const filteredDepartures = departures.filter(res => {
    if (!q) return true
    return (
      (res.guest_name || '').toLowerCase().includes(q) ||
      String(res.rooms?.room_number || '').toLowerCase().includes(q)
    )
  })
  const filteredRequests = requests.filter(req => {
    if (!q) return true
    return (
      (req.hotel_reservations?.guest_name || '').toLowerCase().includes(q) ||
      (req.message || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('navFrontDesk')}</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>+ {t('htNewReservation')}</button>
      </div>

      <div className={styles.filterBar}>
        <button className={`${styles.filterBtn} ${tab === 'checkin' ? styles.filterBtnActive : ''}`} onClick={() => setTab('checkin')}>
          {t('htCheckin')} <span className={styles.filterCount}>{arrivals.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'checkout' ? styles.filterBtnActive : ''}`} onClick={() => setTab('checkout')}>
          {t('htCheckout')} <span className={styles.filterCount}>{departures.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'requests' ? styles.filterBtnActive : ''}`} onClick={() => setTab('requests')}>
          {t('htGuestRequestsTab')}
          {pendingCount > 0 && <span className={`${styles.filterCount} ${styles.filterCountAlert}`}>{pendingCount}</span>}
        </button>
      </div>

      {tab !== 'requests' && (
        <DateNav
          from={from}
          to={to}
          search={search}
          onChange={(f, t) => { setFrom(f); setTo(t) }}
          onSearch={setSearch}
          showFuture={true}
          showMonth={true}
          allowAll={true}
          placeholder={t('htSearchGuestRoom')}
        />
      )}

      {tab === 'requests' && search !== '' && (
        <DateNav
          from={from}
          to={to}
          search={search}
          onChange={(f, t) => { setFrom(f); setTo(t) }}
          onSearch={setSearch}
          showFuture={true}
          hidePeriod={true}
          placeholder={t('htSearchGuestMsg')}
        />
      )}

      {/* ── Check-in tab ── */}
      {tab === 'checkin' && (
        loading ? <LoadingSpinner /> : filteredArrivals.length === 0 ? (
          <div className={styles.empty}><p>{t('htNoArrivals')}</p></div>
        ) : (<>
          {/* Desktop */}
          <div className={styles.fdDesktopTable}>
            <div className={styles.table}>
              <div className={styles.tableHead} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 60px 2fr 160px' }}>
                <SortableHead col="guest_name"     label={t('htGuest')}          sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
                <SortableHead col="rooms.room_number" label={t('htRoomType2')} sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
                <SortableHead col="check_out_date" label={t('htCheckout')}     sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
                <SortableHead col="adults"         label={t('htGuestsHead')}         sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
                <span>{t('htSpecRequests')}</span>
                <span></span>
              </div>
              {ciSort.sort(filteredArrivals).map(res => (
                <div key={res.id} className={styles.tableRow} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 60px 2fr 160px', cursor: 'default' }}>
                  <span className={styles.bold} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {res.guest_name}
                    {res.guest_id && <button className={styles.guestProfileBtn} title={t('htGuestProfile')} onClick={e => { e.stopPropagation(); navigate(`/admin/guests/${res.guest_id}`) }}>👤</button>}
                  </span>
                  <span>
                    <div>{res.rooms?.room_number ? t('htRoomNum', { num: res.rooms.room_number }) : t('htNotAssigned')}</div>
                    {res.room_types?.name && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{res.room_types.name}</div>}
                  </span>
                  <span>{new Date(res.check_out_date).toLocaleDateString(dl)}</span>
                  <span>{(res.adults || 1) + (res.children || 0)}</span>
                  <span style={{ fontSize: 12, color: res.special_requests ? 'var(--c-warning)' : 'var(--c-text-muted)' }}>{res.special_requests || '—'}</span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>{t('htDetails')}</button>
                    <button className={styles.btnPrimary} onClick={() => handleCheckIn(res)}>{t('htCheckin')} ✓</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Mobile */}
          <div className={styles.fdMobileList}>
            {ciSort.sort(filteredArrivals).map(res => (
              <div key={res.id} className={styles.fdCard}>
                <div className={styles.fdCardTop}>
                  <div className={styles.fdCardGuest}>
                    {res.guest_name}
                    {res.guest_id && <button className={styles.guestProfileBtn} title={t('htGuestProfile')} onClick={() => navigate(`/admin/guests/${res.guest_id}`)}>👤</button>}
                  </div>
                  <div className={styles.fdCardRoom}>{res.rooms?.room_number ? t('htRoomNum', { num: res.rooms.room_number }) : '—'}</div>
                </div>
                <div className={styles.fdCardMeta}>
                  {res.room_types?.name && <span>{res.room_types.name}</span>}
                  <span>{t('htCheckout')}: {new Date(res.check_out_date).toLocaleDateString(dl)}</span>
                  <span>👥 {t('htGuestsShort', { n: (res.adults || 1) + (res.children || 0) })}</span>
                </div>
                {res.special_requests && <div className={styles.fdCardNote}>💬 {res.special_requests}</div>}
                <div className={styles.fdCardActions}>
                  <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>{t('htDetails')}</button>
                  <button className={styles.btnPrimary} onClick={() => handleCheckIn(res)}>{t('htCheckin')} ✓</button>
                </div>
              </div>
            ))}
          </div>
        </>)
      )}

      {/* ── Check-out tab ── */}
      {tab === 'checkout' && (
        loading ? <LoadingSpinner /> : filteredDepartures.length === 0 ? (
          <div className={styles.empty}><p>{t('htNoDepartures')}</p></div>
        ) : (<>
          {/* Desktop */}
          <div className={styles.fdDesktopTable}>
            <div className={styles.table}>
              <div className={styles.tableHead} style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 140px' }}>
                <SortableHead col="guest_name"        label={t('htGuest')}     sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
                <SortableHead col="rooms.room_number" label={t('htRoomSingular')}     sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
                <SortableHead col="check_in_date"     label={t('htCheckin')} sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
                <SortableHead col="total_amount"      label={t('htAmount')}    sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
                <span></span>
              </div>
              {coSort.sort(filteredDepartures).map(res => (
                <div key={res.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 140px', cursor: 'default' }}>
                  <span className={styles.bold} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {res.guest_name}
                    {res.guest_id && <button className={styles.guestProfileBtn} title={t('htGuestProfile')} onClick={e => { e.stopPropagation(); navigate(`/admin/guests/${res.guest_id}`) }}>👤</button>}
                  </span>
                  <span>{res.rooms?.room_number ? t('htRoomNum', { num: res.rooms.room_number }) : '—'}</span>
                  <span>{new Date(res.check_in_date).toLocaleDateString(dl)}</span>
                  <span style={{ fontWeight: 600 }}>{res.total_amount ? money(res.total_amount) : '—'}</span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}/folio`)}>{t('htFolio')}</button>
                    <button className={styles.btnPrimary} onClick={() => handleCheckOut(res)}>{t('htCheckout')} ✓</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Mobile */}
          <div className={styles.fdMobileList}>
            {coSort.sort(filteredDepartures).map(res => (
              <div key={res.id} className={styles.fdCard}>
                <div className={styles.fdCardTop}>
                  <div className={styles.fdCardGuest}>
                    {res.guest_name}
                    {res.guest_id && <button className={styles.guestProfileBtn} title={t('htGuestProfile')} onClick={() => navigate(`/admin/guests/${res.guest_id}`)}>👤</button>}
                  </div>
                  <div className={styles.fdCardRoom}>{res.rooms?.room_number ? t('htRoomNum', { num: res.rooms.room_number }) : '—'}</div>
                </div>
                <div className={styles.fdCardMeta}>
                  <span>{t('htCheckin')}: {new Date(res.check_in_date).toLocaleDateString(dl)}</span>
                  {res.total_amount && <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{money(res.total_amount)}</span>}
                </div>
                <div className={styles.fdCardActions}>
                  <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}/folio`)}>{t('htFolio')}</button>
                  <button className={styles.btnPrimary} onClick={() => handleCheckOut(res)}>{t('htCheckout')} ✓</button>
                </div>
              </div>
            ))}
          </div>
        </>)
      )}

      {/* ── Zahtjevi gostiju tab ── */}
      {tab === 'requests' && (
        <>
          {search === '' && (
            <div style={{ marginBottom: 8 }}>
              <DateNav
                from={from}
                to={to}
                search={search}
                onChange={(f, t) => { setFrom(f); setTo(t) }}
                onSearch={setSearch}
                showFuture={true}
                hidePeriod={true}
                placeholder={t('htSearchGuestMsg')}
              />
            </div>
          )}
          {loadingReq ? <LoadingSpinner /> : filteredRequests.length === 0 ? (
            <div className={styles.empty}><p>{t('htNoRequests')}</p></div>
          ) : (<>
            {/* Desktop */}
            <div className={styles.fdDesktopTable}>
              <div className={styles.table}>
                <div className={styles.tableHead} style={{ gridTemplateColumns: '2fr 1fr 2fr 70px 100px 160px' }}>
                  <SortableHead col="hotel_reservations.guest_name"        label={t('htGuest')}    sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                  <SortableHead col="hotel_reservations.rooms.room_number" label={t('htRoomSingular')}    sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                  <span>{t('htMessage')}</span>
                  <SortableHead col="created_at" label={t('htTime')} sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                  <SortableHead col="status"     label={t('htFieldStatus')}  sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                  <span></span>
                </div>
                {reqSort.sort(filteredRequests).map(req => {
                  const st = REQ_STATUS[req.status] ?? REQ_STATUS.pending
                  const guestName = req.hotel_reservations?.guest_name ?? '—'
                  const roomNum = req.hotel_reservations?.rooms?.room_number
                  return (
                    <div key={req.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 2fr 70px 100px 160px', cursor: 'default' }}>
                      <span><div style={{ fontWeight: 600 }}>{REQ_CAT_ICON[req.category] ?? '📋'} {guestName}</div></span>
                      <span>{roomNum ? t('htRoomNum', { num: roomNum }) : '—'}</span>
                      <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{req.message}</span>
                      <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{new Date(req.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: st.color, fontWeight: 600, fontSize: 12 }}>{t(st.labelKey)}</span>
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {req.status === 'pending' && <button className={styles.btnSecondary} disabled={updatingId === req.id} onClick={() => handleStatusChange(req.id, 'in_progress')}>{t('htReqInProgress')}</button>}
                        {req.status !== 'resolved' && <button className={styles.btnPrimary} disabled={updatingId === req.id} onClick={() => handleStatusChange(req.id, 'resolved')}>{t('htReqResolved')} ✓</button>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Mobile */}
            <div className={styles.fdMobileList}>
              {reqSort.sort(filteredRequests).map(req => {
                const st = REQ_STATUS[req.status] ?? REQ_STATUS.pending
                const guestName = req.hotel_reservations?.guest_name ?? '—'
                const roomNum = req.hotel_reservations?.rooms?.room_number
                return (
                  <div key={req.id} className={styles.fdCard}>
                    <div className={styles.fdCardTop}>
                      <div className={styles.fdCardGuest}>{REQ_CAT_ICON[req.category] ?? '📋'} {guestName}</div>
                      {roomNum && <div className={styles.fdCardRoom}>{t('htRoomNum', { num: roomNum })}</div>}
                    </div>
                    <div className={styles.fdCardMsg}>{req.message}</div>
                    <div className={styles.fdCardMeta}>
                      <span>{new Date(req.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className={styles.fdCardStatus} style={{ background: st.bg, color: st.color }}>{t(st.labelKey)}</span>
                    </div>
                    <div className={styles.fdCardActions}>
                      {req.status === 'pending' && <button className={styles.btnSecondary} disabled={updatingId === req.id} onClick={() => handleStatusChange(req.id, 'in_progress')}>{t('htReqInProgress')}</button>}
                      {req.status !== 'resolved' && <button className={styles.btnPrimary} disabled={updatingId === req.id} onClick={() => handleStatusChange(req.id, 'resolved')}>{t('htReqResolved')} ✓</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}
        </>
      )}
    </div>
  )
}
