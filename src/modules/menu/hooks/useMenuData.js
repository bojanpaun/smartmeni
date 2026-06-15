import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { groupByCategory } from './menuHelpers'

// Re-export čistih helpera (definicija u menuHelpers.js — bez supabase importa,
// da ih Vitest testira bez instanciranja klijenta). Postojeći consumeri nepromijenjeni.
export { groupByCategory, cartTotal } from './menuHelpers'

// Učitava kategorije (sort_order) + VIDLJIVE stavke menija (sort_order) po tenantu.
// Vraća kategorije i mapu stavki po kategoriji. Reuse: konobarski unos (+ kasnije drugdje).
export function useMenuData(restaurantId) {
  const [categories, setCategories] = useState([])
  const [itemsByCategory, setItemsByCategory] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('categories').select('id,name,icon,is_bar,sort_order')
        .eq('restaurant_id', restaurantId).order('sort_order'),
      supabase.from('menu_items').select('id,name,price,category_id,emoji')
        .eq('restaurant_id', restaurantId).eq('is_visible', true).order('sort_order'),
    ]).then(([{ data: cats }, { data: items }]) => {
      if (cancelled) return
      setCategories(cats || [])
      setItemsByCategory(groupByCategory(items || []))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  return { categories, itemsByCategory, loading }
}
