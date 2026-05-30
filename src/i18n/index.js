import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import meBooking from './locales/me/booking.json'
import enBooking from './locales/en/booking.json'
import meCommon from './locales/me/common.json'
import enCommon from './locales/en/common.json'

const STORAGE_KEY = 'sm_lang'

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'me' || stored === 'en') return stored
  const browser = navigator.language?.slice(0, 2).toLowerCase()
  return browser === 'en' ? 'en' : 'me'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      me: { booking: meBooking, common: meCommon },
      en: { booking: enBooking, common: enCommon },
    },
    lng: detectLang(),
    fallbackLng: 'me',
    ns: ['booking', 'common'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
