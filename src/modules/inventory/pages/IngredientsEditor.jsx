// ▶ Novi fajl: src/modules/inventory/pages/IngredientsEditor.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './IngredientsEditor.module.css'

export default function IngredientsEditor() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  const [menuItems, setMenuItems] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [ingredients, setIngredients] = useState([]) // sve recepture
  const [selectedMenu, setSelectedMenu] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // Forma za dodavanje sastojka
  const [addForm, setAddForm] = useState({ inventory_item_id: '', quantity: '' })

  useEffect(() => {
    if (restaurant) loadAll()
  }, [restaurant])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: mi }, { data: ii }, { data: ing }] = await Promise.all([
      supabase.from('menu_items').select('id, name, emoji').eq('restaurant_id', restaurant.id).eq('is_visible', true).order('name'),
      supabase.from('inventory_items').select('id, name, unit').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('menu_item_ingredients').select('*, inventory_items(name, unit)')
        .in('menu_item_id', []) // prazan početak, učitava se na select
    ])
    setMenuItems(mi || [])
    setInventoryItems(ii || [])
    setLoading(false)
  }

  const selectMenuItem = async (item) => {
    setSelectedMenu(item)
    setAddForm({ inventory_item_id: '', quantity: '' })
    const { data } = await supabase
      .from('menu_item_ingredients')
      .select('*, inventory_items(name, unit)')
      .eq('menu_item_id', item.id)
    setIngredients(data || [])
  }

  const addIngredient = async (e) => {
    e.preventDefault()
    if (!selectedMenu || !addForm.inventory_item_id) return
    setSaving(true)

    const { data, error } = await supabase
      .from('menu_item_ingredients')
      .upsert({
        menu_item_id: selectedMenu.id,
        inventory_item_id: addForm.inventory_item_id,
        quantity: parseFloat(addForm.quantity),
      }, { onConflict: 'menu_item_id,inventory_item_id' })
      .select('*, inventory_items(name, unit)')
      .single()

    if (!error && data) {
      setIngredients(prev => {
        const exists = prev.find(i => i.inventory_item_id === addForm.inventory_item_id)
        if (exists) return prev.map(i => i.inventory_item_id === addForm.inventory_item_id ? data : i)
        return [...prev, data]
      })
    }
    setAddForm({ inventory_item_id: '', quantity: '' })
    setSaving(false)
  }

  const removeIngredient = async (id) => {
    await supabase.from('menu_item_ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
  }

  const updateQuantity = async (id, qty) => {
    await supabase.from('menu_item_ingredients').update({ quantity: parseFloat(qty) }).eq('id', id)
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, quantity: parseFloat(qty) } : i))
  }

  const filteredMenu = menuItems.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  )

  // Stavke koje još nijesu u recepturi
  const availableItems = inventoryItems.filter(ii =>
    !ingredients.find(ing => ing.inventory_item_id === ii.id)
  )

  if (loading) return <div className={styles.loading}>Učitavanje receptura...</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div className={styles.headerTitle}>Recepture</div>
        <button className={styles.btnBack} onClick={() => navigate('/admin/inventory')}>
          ← Inventar
        </button>
      </div>

      <div className={styles.desc}>
        Definiši koje namirnice se troše za svaku stavku menija. Kad se narudžba primi, zalihe se automatski odbijaju.
      </div>

      <div className={styles.layout}>

        {/* Lijevo — lista stavki menija */}
        <div className={styles.menuList}>
          <div className={styles.menuListHeader}>Stavke menija</div>
          <input
            className={styles.menuSearch}
            placeholder="Pretraži..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {filteredMenu.length === 0 && (
            <div className={styles.menuEmpty}>Nema stavki menija.</div>
          )}
          {filteredMenu.map(item => {
            const hasRecipe = ingredients.some(i => i.menu_item_id === item.id)
            return (
              <div
                key={item.id}
                className={`${styles.menuItem} ${selectedMenu?.id === item.id ? styles.menuItemActive : ''}`}
                onClick={() => selectMenuItem(item)}
              >
                <span className={styles.menuItemEmoji}>{item.emoji}</span>
                <span className={styles.menuItemName}>{item.name}</span>
                {selectedMenu?.id === item.id && ingredients.length > 0 && (
                  <span className={styles.menuItemBadge}>{ingredients.length}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Desno — receptura odabrane stavke */}
        <div className={styles.recipePanel}>
          {!selectedMenu ? (
            <div className={styles.recipeEmpty}>
              <div>🧪</div>
              <div>Odaberi stavku menija da urediš recepturu</div>
            </div>
          ) : (
            <>
              <div className={styles.recipeHeader}>
                <span className={styles.recipeEmoji}>{selectedMenu.emoji}</span>
                <span className={styles.recipeName}>{selectedMenu.name}</span>
              </div>

              {/* Postojeći sastojci */}
              {ingredients.length === 0 ? (
                <div className={styles.recipeNoIng}>Nema definisanih sastojaka za ovu stavku.</div>
              ) : (
                <div className={styles.ingList}>
                  <div className={styles.ingListHeader}>
                    <span>Sastojak</span>
                    <span>Količina po porciji</span>
                    <span></span>
                  </div>
                  {ingredients.map(ing => (
                    <div key={ing.id} className={styles.ingRow}>
                      <div className={styles.ingName}>{ing.inventory_items?.name}</div>
                      <div className={styles.ingQty}>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue={parseFloat(ing.quantity)}
                          onBlur={e => updateQuantity(ing.id, e.target.value)}
                          className={styles.ingQtyInput}
                        />
                        <span className={styles.ingUnit}>{ing.inventory_items?.unit}</span>
                      </div>
                      <button className={styles.ingRemove} onClick={() => removeIngredient(ing.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Dodaj sastojak */}
              {availableItems.length > 0 && (
                <form onSubmit={addIngredient} className={styles.addForm}>
                  <div className={styles.addFormTitle}>+ Dodaj sastojak</div>
                  <div className={styles.addFormRow}>
                    <select
                      value={addForm.inventory_item_id}
                      onChange={e => setAddForm(f => ({ ...f, inventory_item_id: e.target.value }))}
                      className={styles.addSelect}
                      required
                    >
                      <option value="">Odaberi namirnigu...</option>
                      {availableItems.map(ii => (
                        <option key={ii.id} value={ii.id}>{ii.name} ({ii.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Količina"
                      value={addForm.quantity}
                      onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                      className={styles.addQtyInput}
                      required
                    />
                    <button type="submit" className={styles.addBtn} disabled={saving}>
                      {saving ? '...' : 'Dodaj'}
                    </button>
                  </div>
                </form>
              )}

              {availableItems.length === 0 && inventoryItems.length > 0 && (
                <div className={styles.allAdded}>
                  Svi sastojci iz inventara su dodati u recepturu.
                </div>
              )}

              {inventoryItems.length === 0 && (
                <div className={styles.noInventory}>
                  Inventar je prazan. Dodaj namirnice u{' '}
                  <button className={styles.linkBtn} onClick={() => navigate('/admin/inventory')}>Inventar</button>.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
