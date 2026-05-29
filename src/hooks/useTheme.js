import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function storedMode() {
  try { return localStorage.getItem('mode') || 'light' } catch { return 'light' }
}

function cacheScheme(scheme) {
  try { localStorage.setItem('colorScheme', scheme) } catch {}
}

export function useTheme({ restaurant, setRestaurant } = {}) {
  // Paleta: prioritet ima restaurant.admin_theme, zatim localStorage, zatim 'green'
  const [colorScheme, setColorSchemeState] = useState(() => {
    try { return localStorage.getItem('colorScheme') || 'green' } catch { return 'green' }
  })

  // Mod: lična preferencija, samo localStorage
  const [mode, setModeState] = useState(storedMode)

  // Kad restaurant stigne iz baze — sinkronizuj paletu
  useEffect(() => {
    if (restaurant?.admin_theme) {
      setColorSchemeState(restaurant.admin_theme)
      cacheScheme(restaurant.admin_theme)
    }
  }, [restaurant?.admin_theme])

  const theme = mode === 'dark' ? `${colorScheme}-dark` : colorScheme

  // Primijeni data-theme atribut i čuvaj mod u localStorage
  useEffect(() => {
    if (theme === 'green') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    try { localStorage.setItem('mode', mode) } catch {}
  }, [theme, mode])

  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  const setColorScheme = async (scheme) => {
    setColorSchemeState(scheme)
    cacheScheme(scheme)

    if (restaurant?.id && setRestaurant) {
      await supabase
        .from('restaurants')
        .update({ admin_theme: scheme })
        .eq('id', restaurant.id)
      setRestaurant(r => ({ ...r, admin_theme: scheme }))
    }
  }

  return { theme, colorScheme, mode, toggleMode, setColorScheme }
}
