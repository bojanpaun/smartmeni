import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import { useReservations } from '../hooks/useReservations'
import { supabase } from '../../../lib/supabase'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import SortableHead from '../../../components/shared/SortableHead'
import { useSortable } from '../../../hooks/useSortable'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const REQ_STATUS = {
  pending:     { label: 'Primljeno',  color: '#e67e22', bg: '#fff7ed' },
  in_progress: { label: 'U toku',     color: '#2563eb', bg: '#eff6ff' },
  resolved:    { label: 'Riješeno',   color: '#0d7a52', bg: '#ecfdf5' },
}

const REQ_CAT_ICON = {
  housekeeping: '🧹', linen: '🛏️', maintenance: '🔧',
  food: '🍽️', transport: '🚗', info: 'ℹ️', other: '📋',
}

export default function FrontDeskPage() {
  const { restaurant } = usePlatform()
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
        if (!window.confirm(`⚠️ UPOZORENJE: ${g.first_name} ${g.last_name} je na CRNOJ LISTI!\n\nNastavi sa check-inom?`)) return
      }
    }
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_in',
      actual_check_in: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) return toast.error('Greška pri check-inu')

    if (res.room_id) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', res.room_id)
    }

    await supabase.from('folios').insert({
      reservation_id: res.id,
      restaurant_id: restaurant.id,
      guest_id: res.guest_id,
      status: 'open',
      total_amount: res.total_amount ?? 0,
    })

    toast.success(`${res.guest_name} — check-in uspješan`)
    supabase.functions.invoke('send-booking-email', {
      body: { reservation_id: res.id, type: 'checkin' },
    }).catch(() => {})
    refetchArrivals()
  }

  const handleCheckOut = async (res) => {
    const { error } = await supabase.from('hotel_reservations').update({
      status: 'checked_out',
      actual_check_out: new Date().toISOString(),
    }).eq('id', res.id)
    if (error) return toast.error('Greška pri check-outu')

    if (res.room_id) {
      await supabase.from('rooms').update({ status: 'cleaning' }).eq('id', res.room_id)
    }

    await supabase.from('folios').update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('reservation_id', res.id)

    toast.success(`${res.guest_name} — check-out uspješan. Soba na čišćenje.`)
    supabase.functions.invoke('send-booking-email', {
      body: { reservation_id: res.id, type: 'checkout' },
    }).catch(() => {})
    refetchDep()
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
          <h1 className={styles.title}>Front Desk</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>+ Nova rezervacija</button>
      </div>

      <div className={styles.filterBar}>
        <button className={`${styles.filterBtn} ${tab === 'checkin' ? styles.filterBtnActive : ''}`} onClick={() => setTab('checkin')}>
          Check-in <span className={styles.filterCount}>{arrivals.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'checkout' ? styles.filterBtnActive : ''}`} onClick={() => setTab('checkout')}>
          Check-out <span className={styles.filterCount}>{departures.length}</span>
        </button>
        <button className={`${styles.filterBtn} ${tab === 'requests' ? styles.filterBtnActive : ''}`} onClick={() => setTab('requests')}>
          Zahtjevi gostiju
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
          placeholder="Pretraži gosta ili sobu..."
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
          placeholder="Pretraži gosta ili poruku..."
        />
      )}

      {/* ── Check-in tab ── */}
      {tab === 'checkin' && (
        loading ? <LoadingSpinner /> : filteredArrivals.length === 0 ? (
          <div className={styles.empty}><p>Nema dolazaka za odabrani period.</p></div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 60px 2fr 160px' }}>
              <SortableHead col="guest_name"     label="Gost"          sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
              <SortableHead col="rooms.room_number" label="Soba / Tip" sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
              <SortableHead col="check_out_date" label="Check-out"     sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
              <SortableHead col="adults"         label="Gosti"         sortBy={ciSort.sortBy} sortDir={ciSort.sortDir} onSort={ciSort.onSort} />
              <span>Spec. zahtjevi</span>
              <span></span>
            </div>
            {ciSort.sort(filteredArrivals).map(res => (
              <div key={res.id} className={styles.tableRow} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 60px 2fr 160px', cursor: 'default' }}>
                <span className={styles.bold} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {res.guest_name}
                  {res.guest_id && (
                    <button
                      className={styles.guestProfileBtn}
                      title="Profil gosta"
                      onClick={e => { e.stopPropagation(); navigate(`/admin/guests/${res.guest_id}`) }}
                    >👤</button>
                  )}
                </span>
                <span>
                  <div>{res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : 'Nije dodijeljena'}</div>
                  {res.room_types?.name && <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{res.room_types.name}</div>}
                </span>
                <span>{new Date(res.check_out_date).toLocaleDateString('sr-Latn')}</span>
                <span>{(res.adults || 1) + (res.children || 0)}</span>
                <span style={{ fontSize: 12, color: res.special_requests ? 'var(--c-warning)' : 'var(--c-text-muted)' }}>
                  {res.special_requests || '—'}
                </span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>Detalji</button>
                  <button className={styles.btnPrimary} onClick={() => handleCheckIn(res)}>Check-in ✓</button>
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Check-out tab ── */}
      {tab === 'checkout' && (
        loading ? <LoadingSpinner /> : filteredDepartures.length === 0 ? (
          <div className={styles.empty}><p>Nema odjava za odabrani period.</p></div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead} style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 140px' }}>
              <SortableHead col="guest_name"      label="Gost"     sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
              <SortableHead col="rooms.room_number" label="Soba"   sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
              <SortableHead col="check_in_date"   label="Check-in" sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
              <SortableHead col="total_amount"    label="Iznos"    sortBy={coSort.sortBy} sortDir={coSort.sortDir} onSort={coSort.onSort} />
              <span></span>
            </div>
            {coSort.sort(filteredDepartures).map(res => (
              <div key={res.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 1fr 80px 140px', cursor: 'default' }}>
                <span className={styles.bold} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {res.guest_name}
                  {res.guest_id && (
                    <button
                      className={styles.guestProfileBtn}
                      title="Profil gosta"
                      onClick={e => { e.stopPropagation(); navigate(`/admin/guests/${res.guest_id}`) }}
                    >👤</button>
                  )}
                </span>
                <span>{res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : '—'}</span>
                <span>{new Date(res.check_in_date).toLocaleDateString('sr-Latn')}</span>
                <span style={{ fontWeight: 600 }}>{res.total_amount ? `€${Number(res.total_amount).toFixed(2)}` : '—'}</span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}/folio`)}>Folio</button>
                  <button className={styles.btnPrimary} onClick={() => handleCheckOut(res)}>Check-out ✓</button>
                </span>
              </div>
            ))}
          </div>
        )
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
                placeholder="Pretraži gosta ili poruku..."
              />
            </div>
          )}
          {loadingReq ? <LoadingSpinner /> : filteredRequests.length === 0 ? (
            <div className={styles.empty}><p>Nema aktivnih zahtjeva gostiju.</p></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHead} style={{ gridTemplateColumns: '2fr 1fr 2fr 70px 100px 160px' }}>
                <SortableHead col="hotel_reservations.guest_name" label="Gost"    sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                <SortableHead col="hotel_reservations.rooms.room_number" label="Soba" sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                <span>Poruka</span>
                <SortableHead col="created_at" label="Vrijeme"                   sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                <SortableHead col="status"     label="Status"                    sortBy={reqSort.sortBy} sortDir={reqSort.sortDir} onSort={reqSort.onSort} />
                <span></span>
              </div>
              {reqSort.sort(filteredRequests).map(req => {
                const st = REQ_STATUS[req.status] ?? REQ_STATUS.pending
                const guestName = req.hotel_reservations?.guest_name ?? '—'
                const roomNum = req.hotel_reservations?.rooms?.room_number
                return (
                  <div key={req.id} className={styles.tableRow} style={{ gridTemplateColumns: '2fr 1fr 2fr 70px 100px 160px', cursor: 'default' }}>
                    <span>
                      <div style={{ fontWeight: 600 }}>{REQ_CAT_ICON[req.category] ?? '📋'} {guestName}</div>
                    </span>
                    <span>{roomNum ? `Soba ${roomNum}` : '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{req.message}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                      {new Date(req.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: st.color, fontWeight: 600, fontSize: 12 }}>{st.label}</span>
                    <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {req.status === 'pending' && (
                        <button
                          className={styles.btnSecondary}
                          disabled={updatingId === req.id}
                          onClick={() => handleStatusChange(req.id, 'in_progress')}
                        >
                          U toku
                        </button>
                      )}
                      {req.status !== 'resolved' && (
                        <button
                          className={styles.btnPrimary}
                          disabled={updatingId === req.id}
                          onClick={() => handleStatusChange(req.id, 'resolved')}
                        >
                          Riješeno ✓
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
