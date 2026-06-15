import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

// Pure: grupiše stavke menija po category_id → { [categoryId]: Item[] }.
export function groupByCategory(items) {
  const map = {}
  for (const it of items || []) {
    if (!map[it.category_id]) map[it.category_id] = []
    map[it.category_id].push(it)
  }
  return map
}

// Pure: ukupna cijena korpe, zaokruženo na 2 decimale (izbjegava float repove).
export function cartTotal(cart) {
  const sum = (cart || []).reduce(
    (s, c) => s + (Number(c.price) || 0) * (Number(c.qty) || 0), 0)
  return Math.round(sum * 100) / 100
}

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
