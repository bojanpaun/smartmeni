import { useNavigate } from 'react-router-dom'
import styles from './RoomCard.module.css'

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

  const actions = STATUS_ACTIONS[room.status] ?? []

  // Zauzeta + cleaning → zadatak već postoji, nema dugmadi
  // Zauzeta + ostalo  → jedina akcija je čišćenje
  // Slobodna/ostalo   → standardne akcije po statusu
  const visibleActions = isCheckedIn
    ? (room.status === 'cleaning' ? [] : ['cleaning'])
    : actions

  // Primarni badge — dostupnost
  const primaryBadge = isCheckedIn
    ? <span className={styles.badgeOccupied}>Zauzeta</span>
    : room.status === 'blocked'
    ? <span className={styles.badgeBlocked}>Blokirana</span>
    : <span className={styles.badgeAvailable}>Slobodna</span>

  // Sekundarni badge — aktivna operacija (samo kad postoji)
  const secondaryBadge = room.status === 'cleaning'
    ? <span className={styles.badgeCleaning}>🧹 Čišćenje u toku</span>
    : room.status === 'maintenance'
    ? <span className={styles.badgeMaintenance}>🔧 Servis u toku</span>
    : null

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
        <div className={styles.badges}>
          {primaryBadge}
          {secondaryBadge}
        </div>
      </div>

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
