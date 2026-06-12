// ════════════════════════════════════════════════════════════════════════════
// Kanonski registar jezika (data-driven). Dodavanje jezika = dodaj red ovdje +
// locale fajlove u src/i18n/locales/<code>/*.json. Bez izmjene koda igdje drugo.
//
//   ready=true  → kompletno prevedeno; prikazuje se u LanguageSwitcher-u i može
//                 biti auto-detektovan default.
//   ready=false → u pripremi (Faza 1/2); runtime fallback-uje na `me` dok se ne
//                 dodaju locale fajlovi. Ne prikazuje se gostu dok nije spreman.
//
// 7 ciljnih jezika (vidi memoriju project-i18n-multilingual):
// me (primarni/fallback), en, sr, hr, sq (albanski), tr (turski), ru.
// ════════════════════════════════════════════════════════════════════════════

export const DEFAULT_LANG = 'me'

export const LANGUAGES = [
  { code: 'me', native: 'Crnogorski', label: 'MNE', ready: true },
  { code: 'en', native: 'English',    label: 'ENG', ready: true },
  { code: 'sr', native: 'Srpski',     label: 'SRB', ready: true },
  { code: 'hr', native: 'Hrvatski',   label: 'HRV', ready: true },
  { code: 'sq', native: 'Shqip',      label: 'ALB', ready: true },
  { code: 'tr', native: 'Türkçe',     label: 'TUR', ready: true },
  { code: 'ru', native: 'Русский',    label: 'RUS', ready: true },
]

export const LANGUAGE_CODES = LANGUAGES.map(l => l.code)
export const READY_LANGUAGES = LANGUAGES.filter(l => l.ready)

export const isSupported = (code) => LANGUAGE_CODES.includes(code)
export const isReady = (code) => READY_LANGUAGES.some(l => l.code === code)
export const langMeta = (code) => LANGUAGES.find(l => l.code === code) || null
