import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import RoomCard from '../components/RoomCard'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

// Filter: "Zauzete" se sada provjerava prema rezervacijama (checked_in), ne prema rooms.status
const STATUS_FILTERS = [
  { value: '',            label: 'Sve sobe'   },
  { value: 'available',   label: 'Slobodne'   },
  { value: 'occupied',    label: 'Zauzete'    },
  { value: 'cleaning',    label: 'Čišćenje'   },
  { value: 'maintenance', label: 'Servis'     },
  { value: 'blocked',     label: 'Blokirane'  },
]

export default function RoomsPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { rooms, roomTypes, loading, updateRoomStatus } = useRooms(restaurant?.id)
  const [filter, setFilter] = useState('')

  // IDs soba koje trenutno imaju aktivan check-in (status = 'checked_in')
  const [checkedInIds, setCheckedInIds] = useState(new Set())

  useEffect(() => {
    if (!restaurant?.id) return
    supabase
      .from('hotel_reservations')
      .select('room_id')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'checked_in')
      .not('room_id', 'is', null)
      .then(({ data }) => setCheckedInIds(new Set((data ?? []).map(r => r.room_id))))
  }, [restaurant?.id])

  const handleStatusChange = async (roomId, status, prevStatus) => {
    await updateRoomStatus(roomId, status, prevStatus)
    toast.success('Status sobe ažuriran')
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
          <h1 className={styles.title}>Sobe</h1>
          <p className={styles.subtitle}>{rooms.length} soba ukupno</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/admin/hotel/room-types')}>
            Tipovi soba
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms/new')}>
            + Dodaj sobu
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
            {f.label}
            {f.value && (
              <span className={styles.filterCount}>{countFor(f.value)}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>Nema soba{filter ? ' sa ovim statusom' : ''}.</p>
          {!filter && (
            <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms/new')}>
              Dodaj prvu sobu
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
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
