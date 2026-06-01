import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useOccupancy } from '../hooks/useOccupancy'
import { useReservations } from '../hooks/useReservations'
import OccupancyWidget from '../components/OccupancyWidget'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

export default function HotelDashboard() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { stats, loading: loadingStats } = useOccupancy(restaurant?.id)
  const { reservations: checkInsToday, loading: loadingRes } = useReservations(restaurant?.id, {
    status: 'confirmed',
    dateFrom: TODAY,
    dateTo: TODAY,
  })

  if (loadingStats || loadingRes) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Hotel Dashboard</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString('sr-Latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
            + Nova rezervacija
          </button>
        </div>
      </div>

      <OccupancyWidget stats={stats} />

      <div className={styles.quickNav}>
        {[
          { label: 'Sobe',         icon: '🏨', path: '/admin/hotel/rooms' },
          { label: 'Rezervacije',  icon: '📅', path: '/admin/hotel/reservations' },
          { label: 'Front Desk',   icon: '🛎️', path: '/admin/hotel/frontdesk' },
          { label: 'Tipovi soba',  icon: '🪑', path: '/admin/hotel/room-types' },
          { label: 'Gosti',        icon: '👤', path: '/admin/hotel/guests' },
        ].map(item => (
          <button key={item.path} className={styles.quickBtn} onClick={() => navigate(item.path)}>
            <span className={styles.quickIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {checkInsToday.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Check-in danas ({checkInsToday.length})</h2>
          <div className={styles.resList}>
            {checkInsToday.map(res => (
              <div key={res.id} className={styles.resItem} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>
                <div className={styles.resGuest}>{res.guest_name}</div>
                <div className={styles.resMeta}>
                  {res.room_types?.name ?? '—'} · {res.adults}+{res.children} gost(a)
                </div>
                <div className={styles.resNights}>
                  {Math.ceil((new Date(res.check_out_date) - new Date(res.check_in_date)) / 86400000)} noći
                </div>
                <span className={styles.resBadge}>Check-in</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
