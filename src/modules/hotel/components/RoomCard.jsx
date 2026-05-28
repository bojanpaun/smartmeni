import RoomStatusBadge from './RoomStatusBadge'
import styles from './RoomCard.module.css'

const STATUS_ACTIONS = {
  available:   ['occupied', 'maintenance', 'blocked'],
  occupied:    ['cleaning'],
  cleaning:    ['available', 'maintenance'],
  maintenance: ['available', 'blocked'],
  blocked:     ['available'],
}

const ACTION_LABELS = {
  available:   'Označi slobodnom',
  occupied:    'Check-in',
  cleaning:    'Na čišćenje',
  maintenance: 'Na servis',
  blocked:     'Blokiraj',
}

export default function RoomCard({ room, onStatusChange }) {
  const actions = STATUS_ACTIONS[room.status] ?? []

  return (
    <div className={`${styles.card} ${styles[room.status]}`}>
      <div className={styles.header}>
        <span className={styles.number}>{room.room_number}</span>
        <RoomStatusBadge status={room.status} />
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

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map(a => (
            <button
              key={a}
              className={`${styles.btn} ${styles[`btn_${a}`]}`}
              onClick={() => onStatusChange(room.id, a)}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
