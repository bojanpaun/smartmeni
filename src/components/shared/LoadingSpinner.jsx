import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ fullPage = false, size = 32, color = '#0d7a52' }) {
  const spinner = (
    <div className={styles.spinner} style={{ width: size, height: size, borderColor: `${color}22`, borderTopColor: color }} />
  )
  if (fullPage) return <div className={styles.fullPage}>{spinner}</div>
  return spinner
}
