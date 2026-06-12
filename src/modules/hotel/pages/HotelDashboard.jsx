import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useOccupancy } from '../hooks/useOccupancy'
import { useReservations } from '../hooks/useReservations'
import OccupancyWidget from '../components/OccupancyWidget'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

export default function HotelDashboard() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const navigate = useNavigate()
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
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
          <h1 className={styles.title}>{t('htDashTitle')}</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString(dl, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
            + {t('htNewReservation')}
          </button>
        </div>
      </div>

      <OccupancyWidget stats={stats} />

      <div className={styles.quickNav}>
        {[
          { labelKey: 'navRooms',        icon: '🏨', path: '/admin/hotel/rooms' },
          { labelKey: 'navReservations', icon: '📅', path: '/admin/hotel/reservations' },
          { labelKey: 'navFrontDesk',    icon: '🛎️', path: '/admin/hotel/frontdesk' },
          { labelKey: 'navRoomTypes',    icon: '🪑', path: '/admin/hotel/room-types' },
          { labelKey: 'htNavGuests',     icon: '👤', path: '/admin/hotel/guests' },
        ].map(item => (
          <button key={item.path} className={styles.quickBtn} onClick={() => navigate(item.path)}>
            <span className={styles.quickIcon}>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </div>

      {checkInsToday.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('htCheckinTodayCount', { count: checkInsToday.length })}</h2>
          <div className={styles.resList}>
            {checkInsToday.map(res => (
              <div key={res.id} className={styles.resItem} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>
                <div className={styles.resGuest}>{res.guest_name}</div>
                <div className={styles.resMeta}>
                  {res.room_types?.name ?? '—'} · {t('htGuestsCount', { a: res.adults, c: res.children })}
                </div>
                <div className={styles.resNights}>
                  {t('htNights', { n: Math.ceil((new Date(res.check_out_date) - new Date(res.check_in_date)) / 86400000) })}
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
