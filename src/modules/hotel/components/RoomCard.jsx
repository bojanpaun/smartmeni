import { useNavigate } from 'react-router-dom'
import RoomStatusBadge from './RoomStatusBadge'
import styles from './RoomCard.module.css'

// Check-in je uklonjen sa ove stranice — vrši se na Front Desku ili u rezervaciji.
// Dugme 'occupied' (Check-in) više nije dostupno ovdje.
const STATUS_ACTIONS = {
  available:   ['cleaning', 'maintenance', 'blocked'],
  occupied:    ['cleaning'],
  cleaning:    ['available', 'maintenance'],
  maintenance: ['available', 'blocked'],
  blocked:     ['available'],
}

const ACTION_LABELS = {
  available:   'Označi slobodnom',
  cleaning:    'Na čišćenje',
  maintenance: 'Na servis',
  blocked:     'Blokiraj',
}

export default function RoomCard({ room, isCheckedIn, onStatusChange }) {
  const navigate = useNavigate()

  // Akcije se baziraju na rooms.status (za cleaning/maintenance/blocked workflow)
  const actions = STATUS_ACTIONS[room.status] ?? []

  // Zauzeta + cleaning → zadatak već postoji, nema dugmadi
  // Zauzeta + ostalo  → jedina akcija je čišćenje
  // Slobodna/ostalo   → standardne akcije po statusu
  const visibleActions = isCheckedIn
    ? (room.status === 'cleaning' ? [] : ['cleaning'])
    : actions

  return (
    <div className={`${styles.card} ${isCheckedIn ? styles.occupied : styles[room.status]}`}>
      <div className={styles.header}>
        <span
          className={styles.number}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/admin/hotel/rooms/${room.id}`)}
        >
          {room.room_number}
        </span>
        {isCheckedIn
          ? <span className={styles.badgeOccupied}>Zauzeta</span>
          : <RoomStatusBadge status={room.status} />
        }
      </div>
      {isCheckedIn && room.status === 'cleaning' && (
        <div className={styles.cleaningIndicator}>🧹 Čišćenje u toku</div>
      )}

      {room.room_types && (
        <div className={styles.type}>{room.room_types.name}</div>
      )}

      {room.floor != null && (
        <div className={styles.floor}>{room.floor}. sprat</div>
      )}

      {room.notes && (
        <div className={styles.notes}>{room.notes}</div>
      )}

      {visibleActions.length > 0 && (
        <div className={styles.actions}>
          {visibleActions.map(a => (
            <button
              key={a}
              className={`${styles.btn} ${styles[`btn_${a}`]}`}
              onClick={() => onStatusChange(room.id, a, room.status)}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
