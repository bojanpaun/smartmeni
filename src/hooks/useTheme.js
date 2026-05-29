import { useState, useEffect } from 'react'

function readStored() {
  try {
    const scheme = localStorage.getItem('colorScheme') || 'green'
    const mode   = localStorage.getItem('mode')        || 'light'
    return { scheme, mode }
  } catch {
    return { scheme: 'green', mode: 'light' }
  }
}

export function useTheme() {
  const [colorScheme, setColorSchemeState] = useState(() => readStored().scheme)
  const [mode,        setModeState]        = useState(() => readStored().mode)

  const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme

  useEffect(() => {
    if (theme === 'green') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    try {
      localStorage.setItem('colorScheme', colorScheme)
      localStorage.setItem('mode', mode)
    } catch {}
  }, [theme, colorScheme, mode])

  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  const setColorScheme = (scheme) => setColorSchemeState(scheme)

  return { theme, colorScheme, mode, toggleMode, setColorScheme }
}
