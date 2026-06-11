import { useState, useEffect } from 'react'
import { deriveShades } from '../lib/brandPalette'

// Ugrađene palete imaju CSS blokove u index.css ([data-theme="..."]).
const BUILTIN = ['green', 'blue', 'purple']

// jsonb ključ (theme_palettes.light/dark) → CSS varijabla koju override-uje.
const TOKEN_MAP = {
  primary:        '--c-primary',
  primaryHover:   '--c-primary-hover',
  primaryMedium:  '--c-primary-medium',
  primaryLight:   '--c-primary-light',
  primaryMuted:   '--c-primary-muted',
  sbBg:           '--c-sb-bg',
  sbAccent:       '--c-sb-accent',
}
// Neutralni DARK tokeni (pozadine/površine/borderi/tekst) — za custom palete ih
// tintujemo brendovim hue-om jer green-dark baza daje ZELENO tonirane neutrale
// (custom paleta bi inače u dark modu izgledala zeleno). [cssVar, saturacija%, lightness%]
// — S/L preuzeti iz green-dark neutrala, mijenja se samo hue (iz palete).
const DARK_NEUTRAL_TARGETS = [
  ['--c-text',         26, 89],
  ['--c-text-medium',  22, 63],
  ['--c-text-muted',   18, 43],
  ['--c-surface',      18, 14],
  ['--c-bg',           18, 10],
  ['--c-bg-subtle',    18, 15],
  ['--c-border',       20, 21],
  ['--c-border-input', 20, 21],
]
const OVERRIDE_VARS = [
  ...Object.values(TOKEN_MAP),
  '--c-sb-accent-bg',
  ...DARK_NEUTRAL_TARGETS.map(t => t[0]),
]

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function hexToHsl(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return { h: 0, s: 0, l: 0 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  s = Math.min(100, Math.max(0, s)) / 100
  l = Math.min(100, Math.max(0, l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}

// Inline override brend tokena (preko CSS [data-theme] bloka ili :root baze).
// `neutrals` = u dark modu dodatno tintuj neutralne tokene brendovim hue-om
// (samo za custom palete; ugrađene blue/purple-dark imaju vlastite neutrale).
function applyInlineOverride(root, mode, pal, { neutrals = false } = {}) {
  const vars = (mode === 'dark' ? pal?.dark : pal?.light) || {}
  Object.entries(TOKEN_MAP).forEach(([k, cssVar]) => {
    if (vars[k]) root.style.setProperty(cssVar, vars[k])
  })
  const accentBg = hexToRgba(vars.sbAccent, 0.15)
  if (accentBg) root.style.setProperty('--c-sb-accent-bg', accentBg)

  if (neutrals && mode === 'dark') {
    const { h } = hexToHsl(vars.primary || vars.sbAccent || '')
    DARK_NEUTRAL_TARGETS.forEach(([cssVar, s, l]) => {
      root.style.setProperty(cssVar, hslToHex(h, s, l))
    })
  }
}

function storedMode() {
  try { return localStorage.getItem('mode') || 'light' } catch { return 'light' }
}

export function useTheme({ restaurant, palettes = [] } = {}) {
  const [colorScheme, setColorScheme] = useState(() => {
    try { return localStorage.getItem('colorScheme') || 'green' } catch { return 'green' }
  })

  const [mode, setModeState] = useState(storedMode)

  // Kad restaurant stigne iz baze — primijeni njegovu paletu (key)
  useEffect(() => {
    if (restaurant?.admin_theme) {
      setColorScheme(restaurant.admin_theme)
      try { localStorage.setItem('colorScheme', restaurant.admin_theme) } catch {}
    }
  }, [restaurant?.admin_theme])

  useEffect(() => {
    const root = document.documentElement
    // Uvijek prvo očisti eventualne custom override-e prethodne palete.
    OVERRIDE_VARS.forEach(v => root.style.removeProperty(v))

    // Rezervisani key 'brand' — paleta se IZVODI uživo iz restaurant.color (bez
    // perzistencije; uvijek prati boju brenda). Inače: custom paleta iz theme_palettes.
    const pal = colorScheme === 'brand'
      ? (restaurant?.color ? { key: 'brand', ...deriveShades(restaurant.color) } : null)
      : palettes.find(p => p.key === colorScheme)

    if (BUILTIN.includes(colorScheme)) {
      // Ugrađena paleta — koristi CSS [data-theme] blok.
      const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme
      if (theme === 'green') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', theme)
      // Ako superadmin ima override za ugrađenu paletu (theme_palettes red sa istim
      // key-em) — primijeni ga inline preko CSS bloka. Neutrale NE diramo: ugrađeni
      // *-dark blok već daje ispravno tonirane neutrale za tu paletu.
      if (pal) applyInlineOverride(root, mode, pal, { neutrals: false })
    } else {
      // Custom paleta: baza daje neutralne/semantičke tokene (light = :root,
      // dark = green-dark CSS blok), pa inline override-ujemo brend tokene.
      // Inline style na <html> ima prednost nad [data-theme] pravilima.
      // U dark modu green-dark baza je ZELENO tonirana → tintujemo neutrale
      // brendovim hue-om (neutrals: true) da paleta ne izgleda zeleno.
      if (mode === 'dark') root.setAttribute('data-theme', 'green-dark')
      else root.removeAttribute('data-theme')
      applyInlineOverride(root, mode, pal, { neutrals: true })
    }
    try { localStorage.setItem('mode', mode) } catch {}
  }, [colorScheme, mode, palettes, restaurant?.color])

  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme
  return { theme, colorScheme, mode, toggleMode }
}
