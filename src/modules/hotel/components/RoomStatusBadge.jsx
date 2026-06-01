import styles from './RoomStatusBadge.module.css'

const STATUS_CONFIG = {
  available:   { label: 'Slobodna',  color: 'var(--c-primary)',      bg: 'var(--c-primary-light)' },
  occupied:    { label: 'Zauzeta',   color: 'var(--c-primary)',      bg: 'var(--c-primary-light)' },
  cleaning:    { label: 'Čišćenje', color: 'var(--c-warning)',      bg: 'var(--c-warning-bg)' },
  maintenance: { label: 'Servis',    color: 'var(--c-danger)',       bg: 'var(--c-danger-bg)' },
  blocked:     { label: 'Blokirana', color: 'var(--c-text-muted)',   bg: 'var(--c-bg-subtle)' },
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
