import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUAGE_CODES, DEFAULT_LANG, isReady } from './languages'

// Primarni jezici (me/en) ostaju STATIČKI bundlovani → instant prvi paint,
// zadržava postojeće ponašanje. Svi ostali jezici se LAZY učitavaju (svaki
// locale fajl je zaseban Vite chunk) → bundle budžet (hard CI gate) ostaje mali.
import meBooking from './locales/me/booking.json'
import enBooking from './locales/en/booking.json'
import meCommon from './locales/me/common.json'
import enCommon from './locales/en/common.json'

const STORAGE_KEY = 'sm_lang'

// Vite lazy mapa locale fajlova (svi osim me/en koji su statički bundlovani gore).
// Svaki je zaseban chunk: { './locales/sr/menu.json': () => import(...) }
const localeModules = import.meta.glob([
  './locales/*/*.json',
  '!./locales/me/*.json',
  '!./locales/en/*.json',
])

// Custom i18next backend — učita <lng>/<ns> na zahtjev. Ako fajl ne postoji
// (jezik/namespace još nije preveden), vrati prazno → i18next fallback na `me`.
const lazyBackend = {
  type: 'backend',
  init() {},
  read(lng, ns, callback) {
    const loader = localeModules[`./locales/${lng}/${ns}.json`]
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
  } catch { /* SSR/no navigator */ }
  return DEFAULT_LANG
}

i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    // Bundlovani primarni jezici; partialBundledLanguages dozvoljava backend-u da
    // dopuni jezike/namespace-e koji ovdje nisu (lazy).
    resources: {
      me: { booking: meBooking, common: meCommon },
      en: { booking: enBooking, common: enCommon },
    },
    partialBundledLanguages: true,
    lng: detectLang(),
    fallbackLng: DEFAULT_LANG,
    supportedLngs: LANGUAGE_CODES,
    load: 'languageOnly', // en-US → en
    ns: ['common', 'booking'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false }, // backend je async; izbjegni Suspense flicker
  })

i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng) } catch { /* ignore */ }
})

export default i18n
