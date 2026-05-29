import { useTheme } from '../hooks/useTheme'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ variant = 'light' }) {
  const { mode, toggleMode } = useTheme()
  const dark = variant === 'dark'

  return (
    <button
      className={`${styles.modeBtn} ${dark ? styles.modeBtnDark : ''}`}
      onClick={toggleMode}
      title={mode === 'light' ? 'Tamna tema' : 'Svijetla tema'}
    >
      {mode === 'light' ? '🌙' : '☀️'}
    </button>
  )
}
