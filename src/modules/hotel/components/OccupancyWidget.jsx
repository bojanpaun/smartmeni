import { useTranslation } from 'react-i18next'
import styles from './OccupancyWidget.module.css'

export default function OccupancyWidget({ stats }) {
  const { t } = useTranslation('admin')
  if (!stats) return null
  const { total, occupied, available, cleaning, maintenance, occupancyRate, checkInsToday, checkOutsToday } = stats

  return (
    <div className={styles.grid}>
      <div className={styles.main}>
        <div className={styles.rate}>{occupancyRate}%</div>
        <div className={styles.label}>{t('kpiOccupancy')}</div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${occupancyRate}%` }} />
        </div>
        <div className={styles.sub}>{t('htOccRoomsOf', { occupied, total })}</div>
      </div>
      <div className={styles.statGrid}>
        <Stat label={t('htOccFree')}          value={available}       color="#0d7a52" />
        <Stat label={t('htOccOccupied')}       value={occupied}        color="#1a2e26" />
        <Stat label={t('htStCleaning')}        value={cleaning}        color="#ba7517" />
        <Stat label={t('htStMaintenance')}     value={maintenance}     color="#a32d2d" />
        <Stat label={t('kpiCheckinsToday')}    value={checkInsToday}   color="#0d7a52" />
        <Stat label={t('htOccCheckoutToday')}  value={checkOutsToday}  color="#5a7a6a" />
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue} style={{ color }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
