import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'

// Učitava AI prevode tenant-sadržaja (content_translations) za AKTIVNI jezik i
// vraća resolver `tr(entityType, entityId, field, fallback)`. Za 'me' (izvor) i
// nepostojeći prevod vraća fallback — pa GuestMenu/GuestApp/Spa rade bez izmjene
// ponašanja kad prevoda nema. Prevodi su javno čitljivi (anon SELECT, vidi
// migraciju content_translations). Jedan fetch po (restaurantId, jezik).
export function useContentTranslations(restaurantId) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const [map, setMap] = useState(null) // Map ključ→value; null = passthrough (me ili nije učitano)

  useEffect(() => {
    let cancelled = false
    // 'me' je izvor — nema prevoda; isto bez restaurantId (demo/preview).
    if (!restaurantId || lang === 'me') { setMap(null); return }
    supabase
      .from('content_translations')
      .select('entity_type, entity_id, field, value')
      .eq('restaurant_id', restaurantId)
      .eq('lang', lang)
      .then(({ data }) => {
        if (cancelled) return
        const m = new Map()
        for (const r of data ?? []) m.set(`${r.entity_type}|${r.entity_id}|${r.field}`, r.value)
        setMap(m)
      })
    return () => { cancelled = true }
  }, [restaurantId, lang])

  const tr = useCallback((type, id, field, fallback) => {
    if (!map || !id) return fallback
    return map.get(`${type}|${id}|${field}`) ?? fallback
  }, [map])

  return tr
}
