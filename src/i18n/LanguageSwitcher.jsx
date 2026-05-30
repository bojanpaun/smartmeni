import { useTranslation } from 'react-i18next'
import styles from './LanguageSwitcher.module.css'

const LANGS = [
  { code: 'me', label: 'MNE' },
  { code: 'en', label: 'ENG' },
]

export default function LanguageSwitcher({ variant = 'light' }) {
  const { i18n } = useTranslation()
  const current = i18n.language
  const currentLabel = LANGS.find(l => l.code === current)?.label ?? current.toUpperCase()

  return (
    <div className={`${styles.langWrap} ${variant === 'dark' ? styles.langWrapDark : ''}`}>
      <span className={styles.globe}>🌐</span>
      <span className={styles.label}>{currentLabel}</span>
      <span className={styles.chevron}>▾</span>
      <select
        className={styles.nativeSelect}
        value={current}
        onChange={e => i18n.changeLanguage(e.target.value)}
        aria-label="Select language"
      >
        {LANGS.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
    </div>
  )
}
