import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './RoomCard.module.css'

const STATUS_ACTIONS = {
  available:   ['cleaning', 'maintenance', 'blocked'],
  occupied:    ['cleaning', 'maintenance'],
  cleaning:    ['maintenance', 'blocked'],
  maintenance: ['blocked'],
  blocked:     ['available'],
}

const ACTION_LABEL_KEYS = {
  available:   'htActMarkAvailable',
  cleaning:    'htActToCleaning',
  maintenance: 'htActToMaintenance',
  blocked:     'htActBlock',
}

export default function RoomCard({ room, isCheckedIn, hasCleaning, hasMaintenance, onStatusChange }) {
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  const actions = STATUS_ACTIONS[room.status] ?? []

  // Badge logika mora biti iznad visibleActions jer se koristi u filteru
  const showCleaning    = hasCleaning    || room.status === 'cleaning'
  const showMaintenance = hasMaintenance || room.status === 'maintenance'

  // Zauzeta: fiksna baza cleaning+maintenance (rooms.status može biti 'available')
  // Slobodna/ostalo: standardne akcije, minus već aktivne
  const baseActions = isCheckedIn ? ['cleaning', 'maintenance'] : actions
  const visibleActions = baseActions.filter(
    a => !(a === 'cleaning' && showCleaning) && !(a === 'maintenance' && showMaintenance)
  )

  // Primarni badge — dostupnost
  const primaryBadge = isCheckedIn
    ? <span className={styles.badgeOccupied}>{t('htStOccupied')}</span>
    : room.status === 'blocked'
    ? <span className={styles.badgeBlocked}>{t('htStBlocked')}</span>
    : <span className={styles.badgeAvailable}>{t('htStAvailable')}</span>

  // Sekundarni badge-ovi — task u bazi ILI rooms.status
  const cleaningBadge = showCleaning
    ? <span className={styles.badgeCleaning}>🧹 {t('htCleaningInProgress')}</span>
    : null
  const maintBadge = showMaintenance
    ? <span className={styles.badgeMaintenance}>🔧 {t('htMaintInProgress')}</span>
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
          {cleaningBadge}
          {maintBadge}
        </div>
      </div>

      {room.room_types && (
        <div className={styles.type}>{room.room_types.name}</div>
      )}

      {room.floor != null && (
        <div className={styles.floor}>{t('htFloorN', { n: room.floor })}</div>
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
              {t(ACTION_LABEL_KEYS[a])}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
