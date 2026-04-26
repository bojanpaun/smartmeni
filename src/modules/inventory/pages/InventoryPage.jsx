// ▶ Novi fajl: src/modules/inventory/pages/InventoryPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './InventoryPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const UNITS = ['kom', 'kg', 'g', 'l', 'ml', 'pak']
const CATEGORIES = ['namirnice', 'piće', 'alkohol', 'začini', 'ambalaža', 'ostalo']

const UNIT_LABELS = { kom: 'kom', kg: 'kg', g: 'g', l: 'l', ml: 'ml', pak: 'pak' }

export default function InventoryPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('sve')
  const [filterLow, setFilterLow] = useState(false)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showMovement, setShowMovement] = useState(null) // item za ručni pokret
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', category: 'namirnice', unit: 'kom',
    quantity: '', min_quantity: '', cost_per_unit: '', note: '',
  })

  const [movementForm, setMovementForm] = useState({
    type: 'in', quantity: '', note: '',
  })

  useEffect(() => {
    if (restaurant) loadItems()
  }, [restaurant])

  const loadItems = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('category')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  const openForm = (item = null) => {
    if (item) {
      setForm({
        name: item.name, category: item.category,
        unit: item.unit, quantity: item.quantity,
        min_quantity: item.min_quantity,
        cost_per_unit: item.cost_per_unit || '',
        note: item.note || '',
      })
      setEditItem(item)
    } else {
      setForm({ name: '', category: 'namirnice', unit: 'kom', quantity: '', min_quantity: '', cost_per_unit: '', note: '' })
      setEditItem(null)
    }
    setShowForm(true)
  }

  const saveItem = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      name: form.name,
      category: form.category,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 0,
      min_quantity: parseFloat(form.min_quantity) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit) || null,
      note: form.note || null,
    }

    if (editItem) {
      await supabase.from('inventory_items').update(payload).eq('id', editItem.id)
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data } = await supabase.from('inventory_items').insert(payload).select().single()
      setItems(prev => [...prev, data])
    }
    setSaving(false)
    setShowForm(false)
    setEditItem(null)
  }

  const deleteItem = async (id) => {
    if (!confirm('Obrisati ovu stavku iz inventara?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const saveMovement = async (e) => {
    e.preventDefault()
    if (!showMovement) return
    setSaving(true)

    const qty = parseFloat(movementForm.quantity)
    const item = showMovement
    const qtyBefore = parseFloat(item.quantity)
    let qtyAfter
    if (movementForm.type === 'in') qtyAfter = qtyBefore + qty
    else if (movementForm.type === 'out') qtyAfter = Math.max(0, qtyBefore - qty)
    else qtyAfter = qty // adjustment — direktno postavljanje

    // Upiši pokret
    await supabase.from('inventory_movements').insert({
      restaurant_id: restaurant.id,
      item_id: item.id,
      type: movementForm.type,
      quantity: qty,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      note: movementForm.note || null,
      source: 'manual',
    })

    // Ažuriraj stavku
    await supabase.from('inventory_items').update({ quantity: qtyAfter, updated_at: new Date().toISOString() }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: qtyAfter } : i))

    setSaving(false)
    setShowMovement(null)
    setMovementForm({ type: 'in', quantity: '', note: '' })
  }

  // Filtriranje
  const lowItems = items.filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)

  const filtered = items.filter(i => {
    const matchCat = filterCat === 'sve' || i.category === filterCat
    const matchLow = !filterLow || (parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchLow && matchSearch
  })

  const isLow = (item) => parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) <= parseFloat(item.min_quantity)

  if (loading) return <div className={styles.loading}>Učitavanje inventara...</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>Inventar</h1>
          <p className={gsStyles.subtitle}>Upravljajte stavkama zaliha, količinama i minimalnim nivoima.</p>
          {lowItems.length > 0 && (
            <div className={styles.lowBadge}>
              ⚠️ {lowItems.length} {lowItems.length === 1 ? 'stavka' : 'stavki'} ispod minimuma
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnAdd} onClick={() => openForm()}>
            + Nova stavka
          </button>
        </div>
      </div>

      {/* Filteri */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Pretraži inventar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterCats}>
          {['sve', ...CATEGORIES].map(c => (
            <button
              key={c}
              className={`${styles.filterBtn} ${filterCat === c ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterCat(c)}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <button
          className={`${styles.filterBtn} ${filterLow ? styles.filterBtnLow : ''}`}
          onClick={() => setFilterLow(f => !f)}
        >
          ⚠️ Niske zalihe {lowItems.length > 0 && `(${lowItems.length})`}
        </button>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📦</div>
          <div>Nema stavki u inventaru.</div>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ Dodaj prvu stavku</button>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Naziv</span>
            <span>Kategorija</span>
            <span>Količina</span>
            <span>Minimum</span>
            <span>Cijena/jed.</span>
            <span></span>
          </div>
          {filtered.map(item => (
            <div key={item.id} className={`${styles.tableRow} ${isLow(item) ? styles.tableRowLow : ''}`}>
              <div className={styles.itemName}>
                {isLow(item) && <span className={styles.lowDot} title="Ispod minimuma" />}
                {item.name}
                {item.note && <span className={styles.itemNote}>{item.note}</span>}
              </div>
              <div className={styles.itemCat}>{item.category}</div>
              <div className={`${styles.itemQty} ${isLow(item) ? styles.itemQtyLow : ''}`}>
                {parseFloat(item.quantity).toLocaleString('sr')} {item.unit}
              </div>
              <div className={styles.itemMin}>
                {parseFloat(item.min_quantity) > 0
                  ? `${parseFloat(item.min_quantity).toLocaleString('sr')} ${item.unit}`
                  : '—'
                }
              </div>
              <div className={styles.itemCost}>
                {item.cost_per_unit ? `€${parseFloat(item.cost_per_unit).toFixed(2)}` : '—'}
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.btnMovement}
                  onClick={() => { setShowMovement(item); setMovementForm({ type: 'in', quantity: '', note: '' }) }}
                  title="Dodaj/odbitak"
                >
                  ±
                </button>
                <button className={styles.btnEdit} onClick={() => openForm(item)}>Uredi</button>
                <button className={styles.btnDelete} onClick={() => deleteItem(item.id)}>Briši</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forma za novu/uredi stavku */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editItem ? 'Uredi stavku' : 'Nova stavka inventara'}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveItem} className={styles.form}>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Naziv *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Brašno T-500" required />
                </div>
                <div className={styles.field}>
                  <label>Kategorija</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Jedinica mjere</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Trenutna količina</label>
                  <input type="number" min="0" step="0.001" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                </div>
                <div className={styles.field}>
                  <label>Minimalna količina</label>
                  <input type="number" min="0" step="0.001" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} placeholder="0" />
                </div>
                <div className={styles.field}>
                  <label>Cijena po jedinici (€)</label>
                  <input type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Napomena</label>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Dobavljač, napomena..." />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowForm(false)}>Odustani</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ručni pokret */}
      {showMovement && (
        <div className={styles.overlay} onClick={() => setShowMovement(null)}>
          <div className={styles.modalSmall} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Pokret zaliha — {showMovement.name}</div>
              <button className={styles.modalClose} onClick={() => setShowMovement(null)}>✕</button>
            </div>
            <div className={styles.movementCurrent}>
              Trenutno: <strong>{parseFloat(showMovement.quantity).toLocaleString('sr')} {showMovement.unit}</strong>
            </div>
            <form onSubmit={saveMovement} className={styles.form}>
              <div className={styles.movementTypes}>
                {[
                  { value: 'in', label: '+ Ulaz', desc: 'Dodati na zalihu' },
                  { value: 'out', label: '− Izlaz', desc: 'Oduzeti sa zalihe' },
                  { value: 'adjustment', label: '= Korekcija', desc: 'Direktno postaviti' },
                ].map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`${styles.movementTypeBtn} ${movementForm.type === t.value ? styles.movementTypeBtnActive : ''} ${styles[`type-${t.value}`]}`}
                    onClick={() => setMovementForm(f => ({ ...f, type: t.value }))}
                  >
                    <span className={styles.movementTypeBtnLabel}>{t.label}</span>
                    <span className={styles.movementTypeBtnDesc}>{t.desc}</span>
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label>
                  {movementForm.type === 'adjustment' ? 'Nova količina' : 'Količina'} ({showMovement.unit}) *
                </label>
                <input
                  type="number" min="0" step="0.001"
                  value={movementForm.quantity}
                  onChange={e => setMovementForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Napomena</label>
                <input
                  value={movementForm.note}
                  onChange={e => setMovementForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Razlog, dobavljač..."
                />
              </div>
              {movementForm.quantity && (
                <div className={styles.movementPreview}>
                  Rezultat: <strong>
                    {movementForm.type === 'in'
                      ? (parseFloat(showMovement.quantity) + parseFloat(movementForm.quantity || 0)).toLocaleString('sr')
                      : movementForm.type === 'out'
                      ? Math.max(0, parseFloat(showMovement.quantity) - parseFloat(movementForm.quantity || 0)).toLocaleString('sr')
                      : parseFloat(movementForm.quantity || 0).toLocaleString('sr')
                    } {showMovement.unit}
                  </strong>
                </div>
              )}
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowMovement(null)}>Odustani</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj pokret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
