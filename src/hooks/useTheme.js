import { useState, useEffect } from 'react'

const DEFAULT_THEME = 'green'

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || DEFAULT_THEME
  )

  useEffect(() => {
    if (theme === DEFAULT_THEME) {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () =>
    setTheme(t => (t === DEFAULT_THEME ? 'green-dark' : DEFAULT_THEME))

  return { theme, toggle }
}
