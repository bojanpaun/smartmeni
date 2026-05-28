import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useReservations } from '../hooks/useReservations'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

export default function FrontDeskPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [tab, setTab] = useState('checkin')

  const { reservations: arrivals, loading: loadingArrivals, refetch: refetchArrivals } = useReservations(restaurant?.id, {
    status: 'confirmed', dateFrom: TODAY, dateTo: TODAY,
  })
  const { reservations: departures, loading: loadingDep, refetch: refetchDep } = useReservations(restaurant?.id, {
    status: 'checked_in', dateTo: TODAY,
  })

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
    refetchDep()
  }

  const loading = loadingArrivals || loadingDep

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Front Desk</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>+ Nova rezervacija</button>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'checkin' ? styles.tabActive : ''}`} onClick={() => setTab('checkin')}>
          Check-in danas <span className={styles.tabBadge}>{arrivals.length}</span>
        </button>
        <button className={`${styles.tab} ${tab === 'checkout' ? styles.tabActive : ''}`} onClick={() => setTab('checkout')}>
          Check-out <span className={styles.tabBadge}>{departures.length}</span>
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className={styles.fdList}>
          {tab === 'checkin' && (
            arrivals.length === 0 ? <div className={styles.empty}><p>Nema dolazaka danas.</p></div> :
            arrivals.map(res => (
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
          )}
          {tab === 'checkout' && (
            departures.length === 0 ? <div className={styles.empty}><p>Nema odjava danas.</p></div> :
            departures.map(res => (
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
          )}
        </div>
      )}
    </div>
  )
}
