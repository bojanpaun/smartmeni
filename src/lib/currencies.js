// ════════════════════════════════════════════════════════════════════════════
// FISK-0 — Kanonski registar valuta (data-driven, kao i18n/languages.js).
// Jedna aktivna valuta po tenantu (restaurants.currency). NAMJERNO bez FX-konverzije
// među valutama (Princip 0): mijenja se SAMO prikaz/granica, ne preračun.
//
// Dodavanje valute = dodaj red ovdje. Nigdje drugdje. Svi regionalni targeti su
// 2-decimalni → numeric(10,2) i payments minor-unit (×100) pokrivaju za sad.
// Valute sa 0/3 decimale (JPY, KWD…) su odgođene (vidi roadmap FISK-0 caveat).
//
//   code           ISO 4217
//   symbol         za ručni prikaz/fallback (Intl ima svoj)
//   decimals       broj decimala (minor-unit eksponent) — vozi toMinorUnits
//   symbolPosition 'before' | 'after' (ručni fallback kad Intl ne zna valutu)
// ════════════════════════════════════════════════════════════════════════════

export const DEFAULT_CURRENCY = 'EUR'

export const CURRENCIES = [
  { code: 'EUR', symbol: '€',   decimals: 2, symbolPosition: 'before' }, // ME, HR, …
  { code: 'RSD', symbol: 'дин.', decimals: 2, symbolPosition: 'after'  }, // Srbija
  { code: 'BAM', symbol: 'KM',  decimals: 2, symbolPosition: 'after'  }, // BiH
  { code: 'ALL', symbol: 'L',   decimals: 2, symbolPosition: 'after'  }, // Albanija
  { code: 'MKD', symbol: 'ден', decimals: 2, symbolPosition: 'after'  }, // S. Makedonija
  { code: 'TRY', symbol: '₺',   decimals: 2, symbolPosition: 'before' }, // Turska
  { code: 'RUB', symbol: '₽',   decimals: 2, symbolPosition: 'after'  }, // Rusija
  { code: 'CHF', symbol: 'CHF', decimals: 2, symbolPosition: 'before' },
  { code: 'GBP', symbol: '£',   decimals: 2, symbolPosition: 'before' },
  { code: 'USD', symbol: '$',   decimals: 2, symbolPosition: 'before' },
]

export const CURRENCY_CODES = CURRENCIES.map(c => c.code)
export const isSupportedCurrency = (code) => CURRENCY_CODES.includes(code)

// Vrati meta (uvijek nešto upotrebljivo) — nepoznata valuta → razuman default (2 dec).
export function currencyMeta(code) {
  return CURRENCIES.find(c => c.code === code)
    || { code: code || DEFAULT_CURRENCY, symbol: code || '', decimals: 2, symbolPosition: 'before' }
}

// i18n jezik (npr. 'me') → BCP47 locale za Intl. 'me' nije validan tag pa bi Intl
// pao na default grupisanje; mapiramo na crnogorski Latinicom (kao datumi u modulima).
const LOCALE_MAP = { me: 'sr-Latn', sr: 'sr-Latn', en: 'en-US', hr: 'hr', sq: 'sq', tr: 'tr', ru: 'ru' }
export function moneyLocale(lang) {
  return LOCALE_MAP[lang] || lang || 'sr-Latn'
}

// Glavni helper: formatiraj iznos u valuti tenanta na datom jeziku. Zamjenjuje
// hardkodirana `€${x.toFixed(2)}` (display refaktor FISK-0). NE radi konverziju —
// samo prikaz `amount` u zadatoj valuti. `lang` je i18n kod (interno → BCP47).
export function formatMoney(amount, currency = DEFAULT_CURRENCY, lang = 'me') {
  const n = Number(amount)
  const value = Number.isFinite(n) ? n : 0
  const meta = currencyMeta(currency)
  const locale = moneyLocale(lang)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(value)
  } catch {
    // Intl ne zna valutu (ili nevalidan kod) → ručni fallback preko registra.
    const fixed = value.toFixed(meta.decimals)
    return meta.symbolPosition === 'after' ? `${fixed} ${meta.symbol}` : `${meta.symbol}${fixed}`
  }
}

// ── Minor-unit granica (payments / fiskalni total) ──────────────────────────
// Decimal → najmanja jedinica (centi) po decimalama valute. Koristi se na granici
// (payments amountMinor, fiskalni assembly), NE hardkod `*100` / `/100`.
export function toMinorUnits(amount, currency = DEFAULT_CURRENCY) {
  const { decimals } = currencyMeta(currency)
  return Math.round(Number(amount || 0) * 10 ** decimals)
}

export function fromMinorUnits(minor, currency = DEFAULT_CURRENCY) {
  const { decimals } = currencyMeta(currency)
  return Number(minor || 0) / 10 ** decimals
}
