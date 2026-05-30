import { useTranslation } from 'react-i18next'
import styles from './LanguageSwitcher.module.css'

const LANGS = [
  { code: 'me', label: 'MNE' },
  { code: 'en', label: 'ENG' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  return (
    <div className={styles.switcher}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          className={`${styles.btn} ${current === code ? styles.active : ''}`}
          onClick={() => i18n.changeLanguage(code)}
          aria-label={`Switch to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
