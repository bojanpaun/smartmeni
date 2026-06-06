import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './RecipeLibraryPicker.module.css'

const TABS = [
  { key: 'coffee',   label: '☕ Kafa' },
  { key: 'cocktail', label: '🍸 Kokteli' },
]

// Modal: pregled biblioteke preddefinisanih recepata + preuzimanje u meni.
// Preuzimanje ide kroz RPC import_recipe_from_library (kreira menu_item, a uz
// inventory_pro i namirnice + recept). Po završetku zove onImported() za reload.
export default function RecipeLibraryPicker({ onClose, onImported }) {
  const { restaurant, hasAddon } = usePlatform()
  const hasInventory = hasAddon('inventory_pro')

  const [tab, setTab] = useState('coffee')
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState({}) // recipe_id -> [ing]
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadLibrary()
  }, [])

  const loadLibrary = async () => {
    setLoading(true)
    const [{ data: recs }, { data: ings }] = await Promise.all([
      supabase.from('recipe_library')
        .select('id, name, category, emoji, suggested_price')
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
    setLoading(false)
  }

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      })
      if (error) { fail++; continue }
      ok++
      if (data?.menu_created) created++
    }
    setImporting(false)

    if (ok > 0) {
      toast.success(
        `Preuzeto ${ok} ${ok === 1 ? 'stavka' : 'stavki'}` +
        (created < ok ? ` (${ok - created} već postojalo)` : '')
      )
    }
    if (fail > 0) toast.error(`${fail} nije preuzeto`)
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
            <div className={styles.title}>📚 Biblioteka recepata</div>
            <div className={styles.sub}>Preuzmi gotove stavke u svoj meni</div>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.addonNote}>
          {hasInventory
            ? '✓ Imaš Inventar Pro — uz svaku stavku kreiraju se i namirnice + recept (zalihe se odbijaju automatski).'
            : 'ℹ️ Preuzimaju se stavke menija. Uz Inventar Pro automatski bi se kreirali i recepti/zalihe.'}
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>Učitavanje…</div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>Nema stavki u ovoj kategoriji.</div>
          ) : (
            <>
              <button className={styles.selectAll} onClick={toggleAllVisible}>
                {allVisibleSelected ? '☑ Poništi sve' : '☐ Označi sve'}
              </button>
              <div className={styles.list}>
                {visible.map(r => {
                  const isSel = selected.has(r.id)
                  const ings = ingredients[r.id] || []
                  return (
                    <label
                      key={r.id}
                      className={`${styles.row} ${isSel ? styles.rowSel : ''}`}
                      onClick={() => toggle(r.id)}
                    >
                      <input type="checkbox" checked={isSel} readOnly className={styles.check} />
                      <span className={styles.emoji}>{r.emoji}</span>
                      <div className={styles.info}>
                        <div className={styles.name}>{r.name}</div>
                        <div className={styles.ings}>
                          {ings.map(i => `${i.ingredient_name} ${i.quantity}${i.unit}`).join(' · ') || '—'}
                        </div>
                      </div>
                      {r.suggested_price != null && (
                        <span className={styles.price}>€{Number(r.suggested_price).toFixed(2)}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.count}>
            {selected.size > 0 ? `${selected.size} označeno` : 'Ništa nije označeno'}
          </span>
          <div className={styles.actions}>
            <button className={styles.btnCancel} onClick={onClose}>Odustani</button>
            <button
              className={styles.btnImport}
              onClick={doImport}
              disabled={selected.size === 0 || importing}
            >
              {importing ? 'Preuzimanje…' : `Preuzmi${selected.size ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
