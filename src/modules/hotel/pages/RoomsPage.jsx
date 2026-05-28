import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useRooms } from '../hooks/useRooms'
import RoomCard from '../components/RoomCard'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import styles from './Hotel.module.css'

const STATUS_FILTERS = [
  { value: '', label: 'Sve sobe' },
  { value: 'available',   label: 'Slobodne' },
  { value: 'occupied',    label: 'Zauzete' },
  { value: 'cleaning',    label: 'Čišćenje' },
  { value: 'maintenance', label: 'Servis' },
  { value: 'blocked',     label: 'Blokirane' },
]

export default function RoomsPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { rooms, roomTypes, loading, updateRoomStatus } = useRooms(restaurant?.id)
  const [filter, setFilter] = useState('')

  const handleStatusChange = async (roomId, status) => {
    await updateRoomStatus(roomId, status)
    toast.success('Status sobe ažuriran')
  }

  const filtered = filter ? rooms.filter(r => r.status === filter) : rooms

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
            {f.value && <span className={styles.filterCount}>{rooms.filter(r => r.status === f.value).length}</span>}
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
            <RoomCard key={room.id} room={room} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  )
}
