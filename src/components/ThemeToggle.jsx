import { useTheme } from '../hooks/useTheme'
import styles from './ThemeToggle.module.css'

const SCHEMES = [
  { key: 'green', color: '#0d7a52', label: 'Zelena' },
  { key: 'blue',  color: '#2563eb', label: 'Plava'  },
]

export default function ThemeToggle({ variant = 'light' }) {
  const { colorScheme, mode, toggleMode, setColorScheme } = useTheme()
  const dark = variant === 'dark'

  return (
    <div className={`${styles.wrap} ${dark ? styles.wrapDark : ''}`}>
      <div className={styles.swatches}>
        {SCHEMES.map(s => (
          <button
            key={s.key}
            className={`${styles.swatch} ${colorScheme === s.key ? styles.swatchActive : ''}`}
            style={{ '--sw': s.color }}
            onClick={() => setColorScheme(s.key)}
            title={s.label}
          />
        ))}
      </div>
      <button
        className={`${styles.modeBtn} ${dark ? styles.modeBtnDark : ''}`}
        onClick={toggleMode}
        title={mode === 'light' ? 'Tamna tema' : 'Svijetla tema'}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  )
}
