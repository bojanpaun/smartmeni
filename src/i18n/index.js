import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUAGE_CODES, DEFAULT_LANG, isReady } from './languages'

const STORAGE_KEY = 'sm_lang'

// Primarni jezici (me/en) su EAGER (bundlovani → instant prvi paint, svaki namespace).
// Ostali jezici su LAZY (zaseban Vite chunk po fajlu → bundle budžet ostaje mali).
// Dodavanje namespace-a = samo dodaj locale JSON fajlove; ništa se ovdje ne mijenja.
const eager = import.meta.glob(['./locales/me/*.json', './locales/en/*.json'], { eager: true })
const lazy = import.meta.glob(['./locales/*/*.json', '!./locales/me/*.json', '!./locales/en/*.json'])

// Sastavi statičke resurse iz eager mape: { me: { common, booking, ... }, en: {...} }.
const resources = {}
for (const [path, mod] of Object.entries(eager)) {
  const m = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
  if (m) ((resources[m[1]] ??= {})[m[2]] = mod.default || mod)
}

// Lazy backend za ne-bundlovane jezike/namespace-e. Ako fajl ne postoji → prazno
// → i18next fallback na `me`.
const lazyBackend = {
  type: 'backend',
  init() {},
  read(lng, ns, callback) {
    const loader = lazy[`./locales/${lng}/${ns}.json`]
    if (!loader) { callback(null, {}); return }
    loader()
      .then((mod) => callback(null, mod.default || mod))
      .catch((err) => callback(err, null))
  },
}

function detectLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isReady(stored)) return stored
  } catch { /* private mode */ }
  try {
    const browser = navigator.language?.slice(0, 2).toLowerCase()
    if (browser && isReady(browser)) return browser
  } catch { /* no navigator */ }
  return DEFAULT_LANG
}

i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    resources,
    partialBundledLanguages: true, // dopuni iz backend-a jezike/ns koji nisu u resources
    lng: detectLang(),
    fallbackLng: DEFAULT_LANG,
    supportedLngs: LANGUAGE_CODES,
    load: 'languageOnly', // en-US → en
    ns: ['common', 'booking'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng) } catch { /* ignore */ }
})

export default i18n
