import { useTheme } from '../hooks/useTheme'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ variant = 'light' }) {
  const { mode, toggleMode } = useTheme()
  const isDark = mode === 'dark'
  const dark = variant === 'dark'

  return (
    <button
      className={[
        styles.toggle,
        isDark ? styles.isDark : '',
        dark ? styles.toggleDark : '',
      ].join(' ')}
      onClick={toggleMode}
      aria-label={isDark ? 'Svijetla tema' : 'Tamna tema'}
      title={isDark ? 'Svijetla tema' : 'Tamna tema'}
    >
      <span className={styles.knob}>
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}
