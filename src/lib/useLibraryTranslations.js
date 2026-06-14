import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'

// Učitava AI prevode GLOBALNIH biblioteka (library_translations) za AKTIVNI jezik i
// vraća resolver `lt(entityType, id, field, fallback)`. Za 'me' (izvor) i nepostojeći
// prevod vraća fallback. Globalno (bez restaurantId) — biblioteke su superadmin-kurirane
// i dijeljene svim tenantima; admin u pickeru (recepti/spa/minibar) vidi imena na svom
// jeziku panela. Prevode se samo `name` (jedino što pickeri prikazuju).
export function useLibraryTranslations() {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const [map, setMap] = useState(null) // null = passthrough (me ili nije učitano)

  useEffect(() => {
    let cancelled = false
    if (lang === 'me') { setMap(null); return }
    supabase
      .from('library_translations')
      .select('entity_type, entity_id, field, value')
      .eq('lang', lang)
      .then(({ data }) => {
        if (cancelled) return
        const m = new Map()
        for (const r of data ?? []) m.set(`${r.entity_type}|${r.entity_id}|${r.field}`, r.value)
        setMap(m)
      })
    return () => { cancelled = true }
  }, [lang])

  const lt = useCallback((type, id, field, fallback) => {
    if (!map || !id) return fallback
    return map.get(`${type}|${id}|${field}`) ?? fallback
  }, [map])

  return lt
}
