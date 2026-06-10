import { useState, useEffect } from 'react'

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
const OVERRIDE_VARS = [...Object.values(TOKEN_MAP), '--c-sb-accent-bg']

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
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

    if (BUILTIN.includes(colorScheme)) {
      // Ugrađena paleta — koristi CSS [data-theme] blok.
      const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme
      if (theme === 'green') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', theme)
    } else {
      // Custom paleta: baza daje neutralne/semantičke tokene (light = :root,
      // dark = green-dark CSS blok), pa inline override-ujemo brend tokene.
      // Inline style na <html> ima prednost nad [data-theme] pravilima.
      const pal = palettes.find(p => p.key === colorScheme)
      if (mode === 'dark') root.setAttribute('data-theme', 'green-dark')
      else root.removeAttribute('data-theme')
      const vars = (mode === 'dark' ? pal?.dark : pal?.light) || {}
      Object.entries(TOKEN_MAP).forEach(([k, cssVar]) => {
        if (vars[k]) root.style.setProperty(cssVar, vars[k])
      })
      const accentBg = hexToRgba(vars.sbAccent, 0.15)
      if (accentBg) root.style.setProperty('--c-sb-accent-bg', accentBg)
    }
    try { localStorage.setItem('mode', mode) } catch {}
  }, [colorScheme, mode, palettes])

  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme
  return { theme, colorScheme, mode, toggleMode }
}
