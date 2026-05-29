import { useTheme } from '../hooks/useTheme'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ variant = 'light' }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      className={`${styles.btn} ${variant === 'dark' ? styles.btnDark : ''}`}
      onClick={toggle}
      title={theme === 'green' ? 'Tamna tema' : 'Svijetla tema'}
    >
      {theme === 'green' ? '🌙' : '☀️'}
    </button>
  )
}
