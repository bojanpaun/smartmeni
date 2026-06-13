import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { READY_LANGUAGES } from './languages'
import styles from './LanguageSwitcher.module.css'

// Prikazuje samo spremne (prevedene) jezike. Dodavanje jezika u ponudu = označi
// `ready: true` u languages.js (kad locale fajlovi budu kompletni).
// Custom dropdown (ne native <select>) da padajući spisak bude stilski usklađen
// (tokeni, light/dark, obojeni header-i) umjesto OS-native izgleda.
export default function LanguageSwitcher({ variant = 'light' }) {
  const { i18n } = useTranslation()
  const current = i18n.language
  const currentLabel = READY_LANGUAGES.find(l => l.code === current)?.label ?? current.toUpperCase()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const choose = (code) => { i18n.changeLanguage(code); setOpen(false) }

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={`${styles.langWrap} ${variant === 'dark' ? styles.langWrapDark : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <span className={styles.globe}>🌐</span>
        <span className={styles.label}>{currentLabel}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▾</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {READY_LANGUAGES.map(({ code, native }) => (
            <li key={code} role="option" aria-selected={code === current}>
              <button
                type="button"
                className={`${styles.menuItem} ${code === current ? styles.menuItemActive : ''}`}
                onClick={() => choose(code)}
              >
                <span>{native}</span>
                {code === current && <span className={styles.check}>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
