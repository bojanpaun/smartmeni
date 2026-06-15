import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUAGE_CODES, DEFAULT_LANG, isReady } from './languages'

const STORAGE_KEY = 'sm_lang'

// Primarni jezici (me/en) su EAGER (bundlovani → instant prvi paint) — ALI samo javni
// namespace-i. `admin` je velik (~1100 ključeva) i treba se SAMO na /admin rutama, pa ide
// LAZY i za me/en — inače bi naduvao inicijalni JS koji se učitava na SVAKOJ (i javnoj)
// stranici i probio size-limit budžet. Ostali jezici su LAZY u cjelini (chunk po fajlu).
// Dodavanje javnog namespace-a = samo dodaj locale JSON; ništa se ovdje ne mijenja.
// Dodavanje NOVOG velikog admin-only namespace-a = dodaj ga u oba `!...` izuzetka ispod
// (eager) i u `lazyAdmin` (lazy), po uzoru na `admin`.
const eager = import.meta.glob(
  ['./locales/me/*.json', './locales/en/*.json',
    '!./locales/me/admin.json', '!./locales/en/admin.json',
    '!./locales/me/modulehelp.json', '!./locales/en/modulehelp.json'],
  { eager: true },
)
// Lazy mapa: svi ne-me/en fajlovi + eksplicitno me/en veliki admin-only namespace-i
// (admin, modulehelp) koji su izbačeni iz eager-a.
const lazyOthers = import.meta.glob(['./locales/*/*.json', '!./locales/me/*.json', '!./locales/en/*.json'])
const lazyAdmin = import.meta.glob([
  './locales/me/admin.json', './locales/en/admin.json',
  './locales/me/modulehelp.json', './locales/en/modulehelp.json',
])
const lazy = { ...lazyOthers, ...lazyAdmin }

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

// Admin jezik je per-tenant (restaurants.admin_language, vozi ga AdminLangSync u
// App.jsx) + per-sesija override koji admin postavi switcherom (sessionStorage —
// traje samo za tu sesiju, sljedeća se vraća na tenant default). Javne stranice
// koriste sm_lang (localStorage, gost bira). Dva ključa da se ne miješaju.
const ADMIN_OVERRIDE_KEY = 'sm_admin_lang'
function isAdminPath() {
  try {
    const p = window.location.pathname
    return p.startsWith('/admin') || p.startsWith('/superadmin')
  } catch { return false }
}

function detectLang() {
  // Admin rute: per-sesija override ako postoji; inače DEFAULT (AdminLangSync će
  // postaviti tenantov admin_language čim se PlatformContext učita).
  if (isAdminPath()) {
    try {
      const o = sessionStorage.getItem(ADMIN_OVERRIDE_KEY)
      if (o && isReady(o)) return o
    } catch { /* ignore */ }
    return DEFAULT_LANG
  }
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

// Drži <html lang> u skladu sa aktivnim jezikom (a11y/SEO). Naš interni kod `me`
// NIJE validan BCP-47 jezik (to je regionalni kod CG) → validatori i čitači ekrana
// padaju. Mapiramo ga na `sr-ME` (validan tag, pravilan izgovor); ostali kodovi su
// već validni BCP-47 pa idu nepromijenjeni.
const HTML_LANG = { me: 'sr-ME' }
function syncHtmlLang(lng) {
  try { document.documentElement.lang = HTML_LANG[lng] || lng } catch { /* SSR/no document */ }
}
syncHtmlLang(i18n.language || DEFAULT_LANG)

i18n.on('languageChanged', (lng) => {
  syncHtmlLang(lng)
  // Persistuj u odgovarajući ključ po kontekstu: admin → per-sesija override
  // (sessionStorage), javno → gost pref (localStorage). Tako promjena jezika u
  // adminu ne gazi gostov izbor i obrnuto.
  try {
    if (isAdminPath()) sessionStorage.setItem(ADMIN_OVERRIDE_KEY, lng)
    else localStorage.setItem(STORAGE_KEY, lng)
  } catch { /* ignore */ }
})

export default i18n
