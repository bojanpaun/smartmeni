import { useTheme } from '../hooks/useTheme'
import { usePlatform } from '../context/PlatformContext'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ variant = 'light' }) {
  // Proslijedi restaurant da useTheme primijeni paletu iz admin_theme
  // (zelena/plava/ljubičasta). Bez ovoga colorScheme ostaje 'green'.
  const { restaurant } = usePlatform()
  const { mode, toggleMode } = useTheme({ restaurant })
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
