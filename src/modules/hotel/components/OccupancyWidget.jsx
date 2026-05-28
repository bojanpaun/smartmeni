import styles from './OccupancyWidget.module.css'

export default function OccupancyWidget({ stats }) {
  if (!stats) return null
  const { total, occupied, available, cleaning, maintenance, occupancyRate, checkInsToday, checkOutsToday } = stats

  return (
    <div className={styles.grid}>
      <div className={styles.main}>
        <div className={styles.rate}>{occupancyRate}%</div>
        <div className={styles.label}>Popunjenost</div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${occupancyRate}%` }} />
        </div>
        <div className={styles.sub}>{occupied} od {total} soba</div>
      </div>
      <div className={styles.statGrid}>
        <Stat label="Slobodne"  value={available}       color="#0d7a52" />
        <Stat label="Zauzete"   value={occupied}        color="#1a2e26" />
        <Stat label="Čišćenje"  value={cleaning}        color="#ba7517" />
        <Stat label="Servis"    value={maintenance}     color="#a32d2d" />
        <Stat label="Check-in danas"  value={checkInsToday}  color="#0d7a52" />
        <Stat label="Check-out danas" value={checkOutsToday} color="#5a7a6a" />
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
