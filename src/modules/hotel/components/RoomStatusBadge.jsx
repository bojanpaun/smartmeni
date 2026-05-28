import styles from './RoomStatusBadge.module.css'

const STATUS_CONFIG = {
  available:   { label: 'Slobodna',    color: '#0d7a52', bg: '#e8f5f0' },
  occupied:    { label: 'Zauzeta',     color: '#1a2e26', bg: '#d4e8e0' },
  cleaning:    { label: 'Čišćenje',    color: '#ba7517', bg: '#fef3e2' },
  maintenance: { label: 'Servis',      color: '#a32d2d', bg: '#fde8e8' },
  blocked:     { label: 'Blokirana',   color: '#5a7a6a', bg: '#f0f5f2' },
}

export default function RoomStatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.available
  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}
