import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useAdminBadgeRefresh } from '../../../layouts/AdminLayout'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import RoomCard from '../components/RoomCard'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

// Filter: "Zauzete" se sada provjerava prema rezervacijama (checked_in), ne prema rooms.status
const STATUS_FILTERS = [
  { value: '',            labelKey: 'htFilterAll'      },
  { value: 'available',   labelKey: 'htOccFree'        },
  { value: 'occupied',    labelKey: 'htOccOccupied'    },
  { value: 'cleaning',    labelKey: 'htStCleaning'     },
  { value: 'maintenance', labelKey: 'htStMaintenance'  },
  { value: 'blocked',     labelKey: 'htFilterBlocked'  },
]

export default function RoomsPage() {
  const { restaurant } = usePlatform()
  const { refreshCounts } = useAdminBadgeRefresh()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const { rooms, roomTypes, loading, updateRoomStatus } = useRooms(restaurant?.id, refreshCounts)
  const [filter, setFilter] = useState('')

  const [checkedInIds,    setCheckedInIds]    = useState(new Set())
  const [cleaningRoomIds,  setCleaningRoomIds]  = useState(new Set())
  const [maintRoomIds,     setMaintRoomIds]     = useState(new Set())

  const loadTaskSets = (restaurantId) => {
    const rid = restaurantId || restaurant?.id
    if (!rid) return
    const today = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('housekeeping_tasks').select('room_id')
        .eq('restaurant_id', rid)
        .in('status', ['pending', 'in_progress'])
        .eq('scheduled_for', today)
        .not('room_id', 'is', null),
      supabase.from('maintenance_requests').select('room_id')
        .eq('restaurant_id', rid)
        .not('status', 'in', '("verified","resolved")')
        .not('room_id', 'is', null),
    ]).then(([{ data: tasks }, { data: maint }]) => {
      setCleaningRoomIds(new Set((tasks ?? []).map(r => r.room_id)))
      setMaintRoomIds(new Set((maint  ?? []).map(r => r.room_id)))
    })
  }

  useEffect(() => {
    if (!restaurant?.id) return
    supabase.from('hotel_reservations').select('room_id')
      .eq('restaurant_id', restaurant.id).eq('status', 'checked_in')
      .not('room_id', 'is', null)
      .then(({ data }) => setCheckedInIds(new Set((data ?? []).map(r => r.room_id))))
    loadTaskSets(restaurant.id)
  }, [restaurant?.id])

  const handleStatusChange = async (roomId, status, prevStatus) => {
    await updateRoomStatus(roomId, status, prevStatus)
    toast.success(t('htRoomStatusUpdated'))
    // Reload taskova da badge-ovi budu tačni
    loadTaskSets(restaurant?.id)
  }

  // "Zauzeta" u filteru = checked_in iz rezervacija; ostali statusi = rooms.status
  const filtered = rooms.filter(r => {
    if (!filter) return true
    if (filter === 'occupied') return checkedInIds.has(r.id)
    if (filter === 'available') return !checkedInIds.has(r.id) && r.status === 'available'
    return r.status === filter
  })

  // Broj soba po filteru (za badge)
  const countFor = (value) => {
    if (value === 'occupied')  return rooms.filter(r => checkedInIds.has(r.id)).length
    if (value === 'available') return rooms.filter(r => !checkedInIds.has(r.id) && r.status === 'available').length
    return rooms.filter(r => r.status === value).length
  }

  if (loading) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('navRooms')}</h1>
          <p className={styles.subtitle}>{t('htRoomsTotal', { n: rooms.length })}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/room-types')}>
            {t('navRoomTypes')}
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms/new')}>
            + {t('htAddRoom')}
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {t(f.labelKey)}
            {f.value && (
              <span className={styles.filterCount}>{countFor(f.value)}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>{filter ? t('htNoRoomsFiltered') : t('htNoRooms')}</p>
          {!filter && (
            <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms/new')}>
              {t('htAddFirstRoom')}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.roomGrid}>
          {filtered.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              isCheckedIn={checkedInIds.has(room.id)}
              hasCleaning={cleaningRoomIds.has(room.id)}
              hasMaintenance={maintRoomIds.has(room.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
