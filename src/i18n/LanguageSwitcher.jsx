import { useTranslation } from 'react-i18next'
import { READY_LANGUAGES } from './languages'
import styles from './LanguageSwitcher.module.css'

// Prikazuje samo spremne (prevedene) jezike. Dodavanje jezika u ponudu = označi
// `ready: true` u languages.js (kad locale fajlovi budu kompletni).
export default function LanguageSwitcher({ variant = 'light' }) {
  const { i18n } = useTranslation()
  const current = i18n.language
  const currentLabel = READY_LANGUAGES.find(l => l.code === current)?.label ?? current.toUpperCase()

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
        {READY_LANGUAGES.map(({ code, native }) => (
          <option key={code} value={code}>{native}</option>
        ))}
      </select>
    </div>
  )
}
