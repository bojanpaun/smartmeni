import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useReservations } from '../hooks/useReservations'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

function toDateStr(d) { return d.toISOString().slice(0, 10) }

const PERIOD_OPTIONS = [
  { key: 'yesterday', label: 'Juče' },
  { key: 'today',     label: 'Danas' },
  { key: 'tomorrow',  label: 'Sutra' },
  { key: 'custom',    label: 'Period' },
]

function getPeriodDate(key, customDate) {
  const now = new Date()
  if (key === 'today')     return TODAY
  if (key === 'yesterday') { const d = new Date(now); d.setDate(d.getDate() - 1); return toDateStr(d) }
  if (key === 'tomorrow')  { const d = new Date(now); d.setDate(d.getDate() + 1); return toDateStr(d) }
  return customDate || TODAY
}

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
  const navigate = useNavigate()
  const [tab, setTab] = useState('checkin')
  const [period, setPeriod] = useState('today')
  const [customDate, setCustomDate] = useState(TODAY)

  const selectedDate = getPeriodDate(period, customDate)

  const { reservations: arrivals, loading: loadingArrivals, refetch: refetchArrivals } = useReservations(restaurant?.id, {
    status: 'confirmed', checkInDate: selectedDate,
  })
  const { reservations: departures, loading: loadingDep, refetch: refetchDep } = useReservations(restaurant?.id, {
    status: 'checked_in', checkOutDate: selectedDate,
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

  // Real-time subscription za nove zahtjeve
  useEffect(() => {
    if (!restaurant?.id) return
    const channel = supabase.channel('guest_req_fd')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'guest_requests',
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, () => {
        if (tab === 'requests') loadRequests()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id, tab, loadRequests])

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id)
    const patch = { status: newStatus }
    if (newStatus === 'resolved') patch.resolved_at = new Date().toISOString()
    await supabase.from('guest_requests').update(patch).eq('id', id)
    setUpdatingId(null)
    loadRequests()
  }

  const handleCheckIn = async (res) => {
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
        <div className={styles.filterBar} style={{ gap: 6, marginTop: -8, marginBottom: 8 }}>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.key}
              className={`${styles.filterBtn} ${period === p.key ? styles.filterBtnActive : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--c-border)', fontSize: 13, background: 'var(--c-surface)', color: 'var(--c-text)' }}
            />
          )}
        </div>
      )}

      {/* ── Check-in tab ── */}
      {tab === 'checkin' && (
        loading ? <LoadingSpinner /> : (
          <div className={styles.fdList}>
            {arrivals.length === 0
              ? <div className={styles.empty}><p>Nema dolazaka danas.</p></div>
              : arrivals.map(res => (
                <div key={res.id} className={styles.fdCard}>
                  <div className={styles.fdInfo}>
                    <div className={styles.fdName}>{res.guest_name}</div>
                    <div className={styles.fdMeta}>
                      {res.room_types?.name ?? '—'} · {res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : 'Soba nije dodijeljena'}
                    </div>
                    <div className={styles.fdMeta}>
                      {res.adults}+{res.children} gost(a) · do {new Date(res.check_out_date).toLocaleDateString('sr-Latn')}
                    </div>
                    {res.special_requests && <div className={styles.fdNote}>{res.special_requests}</div>}
                  </div>
                  <div className={styles.fdActions}>
                    <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>Detalji</button>
                    <button className={styles.btnPrimary} onClick={() => handleCheckIn(res)}>Check-in ✓</button>
                  </div>
                </div>
              ))
            }
          </div>
        )
      )}

      {/* ── Check-out tab ── */}
      {tab === 'checkout' && (
        loading ? <LoadingSpinner /> : (
          <div className={styles.fdList}>
            {departures.length === 0
              ? <div className={styles.empty}><p>Nema odjava danas.</p></div>
              : departures.map(res => (
                <div key={res.id} className={styles.fdCard}>
                  <div className={styles.fdInfo}>
                    <div className={styles.fdName}>{res.guest_name}</div>
                    <div className={styles.fdMeta}>
                      {res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : '—'} · check-in {new Date(res.check_in_date).toLocaleDateString('sr-Latn')}
                    </div>
                    {res.total_amount && (
                      <div className={styles.fdMeta}>Ukupno: €{Number(res.total_amount).toFixed(2)} · {res.payment_status}</div>
                    )}
                  </div>
                  <div className={styles.fdActions}>
                    <button className={styles.btnSecondary} onClick={() => navigate(`/admin/hotel/reservations/${res.id}/folio`)}>Folio</button>
                    <button className={styles.btnPrimary} onClick={() => handleCheckOut(res)}>Check-out ✓</button>
                  </div>
                </div>
              ))
            }
          </div>
        )
      )}

      {/* ── Zahtjevi gostiju tab ── */}
      {tab === 'requests' && (
        loadingReq ? <LoadingSpinner /> : (
          <div className={styles.fdList}>
            {requests.length === 0
              ? <div className={styles.empty}><p>Nema aktivnih zahtjeva gostiju.</p></div>
              : requests.map(req => {
                const st = REQ_STATUS[req.status] ?? REQ_STATUS.pending
                const guestName = req.hotel_reservations?.guest_name ?? '—'
                const roomNum = req.hotel_reservations?.rooms?.room_number
                return (
                  <div key={req.id} className={styles.fdCard}>
                    <div className={styles.fdInfo}>
                      <div className={styles.fdName}>
                        {REQ_CAT_ICON[req.category] ?? '📋'} {guestName}
                        {roomNum && <span className={styles.fdMeta}> · Soba {roomNum}</span>}
                      </div>
                      <div className={styles.fdNote} style={{ marginTop: 4 }}>{req.message}</div>
                      <div className={styles.fdMeta} style={{ marginTop: 4 }}>
                        {new Date(req.created_at).toLocaleTimeString('sr-Latn', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        <span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>
                      </div>
                    </div>
                    <div className={styles.fdActions} style={{ flexDirection: 'column', gap: 6 }}>
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
                    </div>
                  </div>
                )
              })
            }
          </div>
        )
      )}
    </div>
  )
}
