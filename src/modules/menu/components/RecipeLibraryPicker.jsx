import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { useLibraryTranslations } from '../../../lib/useLibraryTranslations'
import styles from './RecipeLibraryPicker.module.css'

// Meta po kategoriji: emoji + labelKey (prevod) + redoslijed taba. Nepoznata → fallback.
const CAT_META = {
  coffee:    { emoji: '☕',  labelKey: 'rlpCatCoffee',     order: 1 },
  cocktail:  { emoji: '🍸',  labelKey: 'rlpCatCocktail',   order: 2 },
  soft:      { emoji: '🥤',  labelKey: 'rlpCatSoft',       order: 3 },
  hot:       { emoji: '🍵',  labelKey: 'rlpCatHot',        order: 4 },
  beverage:  { emoji: '🍺',  labelKey: 'rlpCatBeverage',   order: 5 },
  soup:      { emoji: '🍲',  labelKey: 'rlpCatSoup',       order: 6 },
  food:      { emoji: '🍽️',  labelKey: 'rlpCatFood',       order: 7 },
  vegetarian:{ emoji: '🥦',  labelKey: 'rlpCatVegetarian', order: 8 },
  salad:     { emoji: '🥗',  labelKey: 'rlpCatSalad',      order: 9 },
  side:      { emoji: '🍚',  labelKey: 'rlpCatSide',       order: 10 },
  breakfast: { emoji: '🍳',  labelKey: 'rlpCatBreakfast',  order: 11 },
  dessert:   { emoji: '🍰',  labelKey: 'rlpCatDessert',    order: 12 },
  kids:      { emoji: '🧒',  labelKey: 'rlpCatKids',       order: 13 },
}
const catOrder = (key) => CAT_META[key]?.order ?? 99

// Modal: pregled biblioteke preddefinisanih recepata + preuzimanje u meni.
// Preuzimanje ide kroz RPC import_recipe_from_library (kreira menu_item, a uz
// inventory_pro i namirnice + recept). Po završetku zove onImported() za reload.
export default function RecipeLibraryPicker({ onClose, onImported, categories = [], defaultCategoryId = '' }) {
  const { t } = useTranslation('admin')
  const { restaurant, hasAddon } = usePlatform()
  const lt = useLibraryTranslations()
  const hasInventory = hasAddon('inventory_pro')
  // Naziv kategorije = emoji (data) + prevedeni naziv; nepoznata → ključ.
  const catLabel = (key) => CAT_META[key] ? `${CAT_META[key].emoji} ${t(CAT_META[key].labelKey)}` : key

  const [tab, setTab] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState({}) // recipe_id -> [ing]
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [targetCategoryId, setTargetCategoryId] = useState(defaultCategoryId || '')

  useEffect(() => {
    loadLibrary()
  }, [])

  const loadLibrary = async () => {
    setLoading(true)
    const [{ data: recs }, { data: ings }] = await Promise.all([
      supabase.from('recipe_library')
        .select('id, name, category, emoji, suggested_price, image_url')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('recipe_library_ingredients')
        .select('recipe_id, ingredient_name, quantity, unit, sort_order')
        .order('sort_order'),
    ])
    const byRecipe = {}
    for (const ing of (ings || [])) {
      (byRecipe[ing.recipe_id] ||= []).push(ing)
    }
    setRecipes(recs || [])
    setIngredients(byRecipe)
    // Prvi tab = kategorija s najmanjim order-om među prisutnima.
    const cats = [...new Set((recs || []).map(r => r.category))].sort((a, b) => catOrder(a) - catOrder(b))
    setTab(cats[0] || null)
    setLoading(false)
  }

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const tabs = [...new Set(recipes.map(r => r.category))].sort((a, b) => catOrder(a) - catOrder(b))
  const visible = recipes.filter(r => r.category === tab)
  const visibleSelectedCount = visible.filter(r => selected.has(r.id)).length
  const allVisibleSelected = visible.length > 0 && visibleSelectedCount === visible.length

  const toggleAllVisible = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach(r => next.delete(r.id))
      else visible.forEach(r => next.add(r.id))
      return next
    })
  }

  const doImport = async () => {
    if (selected.size === 0 || !restaurant) return
    setImporting(true)
    let ok = 0, created = 0, fail = 0
    for (const id of selected) {
      const { data, error } = await supabase.rpc('import_recipe_from_library', {
        p_recipe_id: id,
        p_restaurant_id: restaurant.id,
        p_category_id: targetCategoryId || null,
      })
      if (error) { fail++; continue }
      ok++
      if (data?.menu_created) created++
    }
    setImporting(false)

    if (ok > 0) {
      let msg = t('rlpImportedN', { n: ok })
      if (created < ok) msg += ' ' + t('rlpExisted', { n: ok - created })
      toast.success(msg)
    }
    if (fail > 0) toast.error(t('rlpFailedN', { n: fail }))
    if (ok > 0) {
      onImported?.()
      onClose?.()
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div>
            <div className={styles.title}>📚 {t('rlpTitle')}</div>
            <div className={styles.sub}>{t('rlpSub')}</div>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.scroll}>
        <div className={styles.addonNote}>
          {hasInventory ? `✓ ${t('rlpAddonYes')}` : `ℹ️ ${t('rlpAddonNo')}`}
        </div>

        <div className={styles.disclaimer}>
          ⓘ {t('rlpDisclaimer')}
        </div>

        <div className={styles.targetRow}>
          <label>{t('rlpAddToCategory')}</label>
          <select value={targetCategoryId} onChange={e => setTargetCategoryId(e.target.value)}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
            <option value="">{t('rlpNewAuto')}</option>
          </select>
        </div>

        <div className={styles.tabs}>
          {tabs.map(key => (
            <button
              key={key}
              className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
              onClick={() => setTab(key)}
            >
              {catLabel(key)}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>{t('loading')}</div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>{t('rlpEmpty')}</div>
          ) : (
            <>
              <button className={styles.selectAll} onClick={toggleAllVisible}>
                {allVisibleSelected ? `☑ ${t('rlpDeselectAll')}` : `☐ ${t('rlpSelectAll')}`}
              </button>
              <div className={styles.list}>
                {visible.map(r => {
                  const isSel = selected.has(r.id)
                  const ings = ingredients[r.id] || []
                  return (
                    <div
                      key={r.id}
                      className={`${styles.row} ${isSel ? styles.rowSel : ''}`}
                      onClick={() => toggle(r.id)}
                    >
                      <input type="checkbox" checked={isSel} readOnly className={styles.check} />
                      {r.image_url
                        ? <img src={r.image_url} alt="" className={styles.thumb} loading="lazy" />
                        : <span className={styles.emoji}>{r.emoji}</span>}
                      <div className={styles.info}>
                        <div className={styles.name}>{lt('recipe_library', r.id, 'name', r.name)}</div>
                        <div className={styles.ings}>
                          {ings.map(i => `${i.ingredient_name} ${i.quantity}${i.unit}`).join(' · ') || '—'}
                        </div>
                      </div>
                      {r.suggested_price != null && (
                        <span className={styles.price}>€{Number(r.suggested_price).toFixed(2)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.count}>
            {selected.size > 0 ? t('rlpNSelected', { n: selected.size }) : t('rlpNoneSelected')}
          </span>
          <div className={styles.actions}>
            <button className={styles.btnCancel} onClick={onClose}>{t('cancel')}</button>
            <button
              className={styles.btnImport}
              onClick={doImport}
              disabled={selected.size === 0 || importing}
            >
              {importing ? t('rlpImporting') : `${t('rlpImport')}${selected.size ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
