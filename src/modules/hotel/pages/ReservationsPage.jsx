import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useReservations } from '../hooks/useReservations'
import RoomStatusBadge from '../components/RoomStatusBadge'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const STATUS_COLORS = {
  inquiry:     '#8a9e96',
  confirmed:   '#0d7a52',
  checked_in:  '#1a2e26',
  checked_out: '#5a7a6a',
  cancelled:   '#a32d2d',
  no_show:     '#ba7517',
}
const STATUS_LABELS = {
  inquiry: 'Upit', confirmed: 'Potvrđena', checked_in: 'Prisutna',
  checked_out: 'Odjavljena', cancelled: 'Otkazana', no_show: 'No-show',
}

const STATUS_FILTERS = ['', 'confirmed', 'checked_in', 'checked_out', 'cancelled']

export default function ReservationsPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const { reservations, loading } = useReservations(restaurant?.id, { status: statusFilter || undefined })

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rezervacije</h1>
          <p className={styles.subtitle}>{reservations.length} rezervacija</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
          + Nova rezervacija
        </button>
      </div>

      <div className={styles.filterBar}>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s ? STATUS_LABELS[s] : 'Sve'}
          </button>
        ))}
      </div>

      {reservations.length === 0 ? (
        <div className={styles.empty}><p>Nema rezervacija.</p></div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Gost</span>
            <span>Soba</span>
            <span>Check-in</span>
            <span>Check-out</span>
            <span>Noći</span>
            <span>Iznos</span>
            <span>Status</span>
          </div>
          {reservations.map(res => {
            const nights = Math.ceil((new Date(res.check_out_date) - new Date(res.check_in_date)) / 86400000)
            return (
              <div key={res.id} className={styles.tableRow} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>
                <span className={styles.bold}>{res.guest_name}</span>
                <span>{res.rooms?.room_number ?? res.room_types?.name ?? '—'}</span>
                <span>{new Date(res.check_in_date).toLocaleDateString('sr-Latn')}</span>
                <span>{new Date(res.check_out_date).toLocaleDateString('sr-Latn')}</span>
                <span>{nights}</span>
                <span>{res.total_amount ? `€${Number(res.total_amount).toFixed(0)}` : '—'}</span>
                <span>
                  <span style={{ color: STATUS_COLORS[res.status], fontSize: 12, fontWeight: 600, padding: '2px 8px', background: STATUS_COLORS[res.status] + '18', borderRadius: 20 }}>
                    {STATUS_LABELS[res.status] ?? res.status}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
