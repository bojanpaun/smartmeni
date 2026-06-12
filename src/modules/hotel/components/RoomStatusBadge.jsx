import { useTranslation } from 'react-i18next'
import styles from './RoomStatusBadge.module.css'

const STATUS_CONFIG = {
  available:   { labelKey: 'htStAvailable',   color: 'var(--c-primary)',      bg: 'var(--c-primary-light)' },
  occupied:    { labelKey: 'htStOccupied',    color: 'var(--c-primary)',      bg: 'var(--c-primary-light)' },
  cleaning:    { labelKey: 'htStCleaning',    color: 'var(--c-warning)',      bg: 'var(--c-warning-bg)' },
  maintenance: { labelKey: 'htStMaintenance', color: 'var(--c-danger)',       bg: 'var(--c-danger-bg)' },
  blocked:     { labelKey: 'htStBlocked',     color: 'var(--c-text-muted)',   bg: 'var(--c-bg-subtle)' },
}

export default function RoomStatusBadge({ status, size = 'sm' }) {
  const { t } = useTranslation('admin')
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.available
  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {t(cfg.labelKey)}
    </span>
  )
}
