import styles from './Skeleton.module.css'

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.block} ${styles.title}`} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`${styles.block} ${styles.line}`} style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className={styles.table}>
      <div className={styles.tableHeader}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={`${styles.block} ${styles.headerCell}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.tableRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`${styles.block} ${styles.cell}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
