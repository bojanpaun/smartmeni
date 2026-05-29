import { useState, useEffect } from 'react'

function storedMode() {
  try { return localStorage.getItem('mode') || 'light' } catch { return 'light' }
}

export function useTheme({ restaurant } = {}) {
  const [colorScheme, setColorScheme] = useState(() => {
    try { return localStorage.getItem('colorScheme') || 'green' } catch { return 'green' }
  })

  const [mode, setModeState] = useState(storedMode)

  // Kad restaurant stigne iz baze — primijeni njegovu paletu
  useEffect(() => {
    if (restaurant?.admin_theme) {
      setColorScheme(restaurant.admin_theme)
      try { localStorage.setItem('colorScheme', restaurant.admin_theme) } catch {}
    }
  }, [restaurant?.admin_theme])

  const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme

  useEffect(() => {
    if (theme === 'green') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    try { localStorage.setItem('mode', mode) } catch {}
  }, [theme, mode])

  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  return { theme, colorScheme, mode, toggleMode }
}
