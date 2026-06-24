// ▶ Novi fajl: src/modules/inventory/pages/InventoryPage.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { logAudit } from '../../../lib/auditLog'
import { useMoney } from '../../../lib/useMoney'
import { useSortable } from '../../../hooks/useSortable'
import SortableHead from '../../../components/shared/SortableHead'
import styles from './InventoryPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const UNITS = ['kom', 'kg', 'g', 'l', 'ml', 'pak']
const CATEGORIES = ['namirnice', 'piće', 'alkohol', 'začini', 'ambalaža', 'ostalo']

// Stored DB enum vrijednost → prevodni ključ (vrijednost u bazi ostaje crnogorska).
const CAT_KEYS = {
  namirnice: 'invCatNamirnice', 'piće': 'invCatPice', alkohol: 'invCatAlkohol',
  'začini': 'invCatZacini', 'ambalaža': 'invCatAmbalaza', ostalo: 'invCatOstalo',
}

export default function InventoryPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')
  const money = useMoney()

  const catLabel = (c) => t(CAT_KEYS[c] || 'invCatOstalo')
  const unitLabel = (u) => u === 'kom' ? t('invUnitKom') : u === 'pak' ? t('invUnitPak') : u

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

    let savedId = editItem?.id
    if (editItem) {
      await supabase.from('inventory_items').update(payload).eq('id', editItem.id)
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data } = await supabase.from('inventory_items').insert(payload).select().single()
      savedId = data?.id
      setItems(prev => [...prev, data])
    }
    logAudit({
      restaurantId: restaurant.id,
      action: editItem ? 'inventory_item.updated' : 'inventory_item.created',
      entityType: 'inventory_item', entityId: savedId,
      summary: `${editItem ? 'Izmijenjen' : 'Dodat'} artikal zalihe: ${form.name}`,
    })
    setSaving(false)
    setShowForm(false)
    setEditItem(null)
  }

  const deleteItem = async (id) => {
    if (!confirm(t('invDeleteConfirm'))) return
    const removed = items.find(i => i.id === id)
    await supabase.from('inventory_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    logAudit({
      restaurantId: restaurant.id, action: 'inventory_item.deleted',
      entityType: 'inventory_item', entityId: id,
      summary: `Obrisan artikal zalihe: ${removed?.name ?? ''}`,
    })
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

    const moveLabel = movementForm.type === 'in' ? 'Ulaz' : movementForm.type === 'out' ? 'Izlaz' : 'Korekcija'
    logAudit({
      restaurantId: restaurant.id, action: 'inventory.movement',
      entityType: 'inventory_item', entityId: item.id,
      summary: `${moveLabel} — ${item.name}: ${qtyBefore} → ${qtyAfter}${item.unit ? ' ' + item.unit : ''}`,
      metadata: { type: movementForm.type, quantity: qty },
    })

    setSaving(false)
    setShowMovement(null)
    setMovementForm({ type: 'in', quantity: '', note: '' })
  }

  // Filtriranje
  const sort = useSortable('name', 'asc')
  const lowItems = items.filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)

  const filtered = items.filter(i => {
    const matchCat = filterCat === 'sve' || i.category === filterCat
    const matchLow = !filterLow || (parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchLow && matchSearch
  })

  const isLow = (item) => parseFloat(item.min_quantity) > 0 && parseFloat(item.quantity) <= parseFloat(item.min_quantity)

  if (loading) return <div className={styles.loading}>{t('invLoading')}</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>{t('invTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('invSubtitle')}</p>
          {lowItems.length > 0 && (
            <div className={styles.lowBadge}>
              ⚠️ {t('invLowItems', { count: lowItems.length })}
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnAdd} onClick={() => openForm()}>
            + {t('invNewItem')}
          </button>
        </div>
      </div>

      {/* Filteri */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder={t('invSearchPlaceholder')}
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
              {c === 'sve' ? t('invCatAll') : catLabel(c)}
            </button>
          ))}
        </div>
        <button
          className={`${styles.filterBtn} ${filterLow ? styles.filterBtnLow : ''}`}
          onClick={() => setFilterLow(f => !f)}
        >
          ⚠️ {t('invLowStock')} {lowItems.length > 0 && `(${lowItems.length})`}
        </button>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📦</div>
          <div>{t('invEmpty')}</div>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ {t('invAddFirst')}</button>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span><SortableHead col="name"          label={t('invColName')}     sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="category"      label={t('invColCategory')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="quantity"      label={t('invColQuantity')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="min_quantity"  label={t('invColMin')}      sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span><SortableHead col="cost_per_unit" label={t('invColCostUnit')} sortBy={sort.sortBy} sortDir={sort.sortDir} onSort={sort.onSort} /></span>
            <span></span>
          </div>
          {sort.sort(filtered).map(item => (
            <div key={item.id} className={`${styles.tableRow} ${isLow(item) ? styles.tableRowLow : ''}`}>
              <div className={styles.itemName}>
                {isLow(item) && <span className={styles.lowDot} title={t('invBelowMin')} />}
                {item.name}
                {item.note && <span className={styles.itemNote}>{item.note}</span>}
              </div>
              <div className={styles.itemCat}>{catLabel(item.category)}</div>
              <div className={`${styles.itemQty} ${isLow(item) ? styles.itemQtyLow : ''}`}>
                {parseFloat(item.quantity).toLocaleString('sr')} {unitLabel(item.unit)}
              </div>
              <div className={styles.itemMin}>
                {parseFloat(item.min_quantity) > 0
                  ? `${parseFloat(item.min_quantity).toLocaleString('sr')} ${unitLabel(item.unit)}`
                  : '—'
                }
              </div>
              <div className={styles.itemCost}>
                {item.cost_per_unit ? money(item.cost_per_unit) : '—'}
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.btnMovement}
                  onClick={() => { setShowMovement(item); setMovementForm({ type: 'in', quantity: '', note: '' }) }}
                  title={t('invMovementTitle')}
                >
                  ±
                </button>
                <button className={styles.btnEdit} onClick={() => openForm(item)}>{t('htEdit')}</button>
                <button className={styles.btnDelete} onClick={() => deleteItem(item.id)}>{t('invDelete')}</button>
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
              <div className={styles.modalTitle}>{editItem ? t('invEditItem') : t('invNewItemTitle')}</div>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveItem} className={styles.form}>
              <div className={styles.grid}>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('invFieldName')}</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="npr. Brašno T-500" required />
                </div>
                <div className={styles.field}>
                  <label>{t('invFieldCategory')}</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('invFieldUnit')}</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('invFieldQuantity')}</label>
                  <input type="number" min="0" step="0.001" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                </div>
                <div className={styles.field}>
                  <label>{t('invFieldMinQuantity')}</label>
                  <input type="number" min="0" step="0.001" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: e.target.value }))} placeholder="0" />
                </div>
                <div className={styles.field}>
                  <label>{t('invFieldCostUnit')}</label>
                  <input type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('hkpNote')}</label>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('invPhSupplierNote')} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? t('saving') : t('save')}
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
              <div className={styles.modalTitle}>{t('invMovementHead')} — {showMovement.name}</div>
              <button className={styles.modalClose} onClick={() => setShowMovement(null)}>✕</button>
            </div>
            <div className={styles.movementCurrent}>
              {t('invCurrent')}: <strong>{parseFloat(showMovement.quantity).toLocaleString('sr')} {unitLabel(showMovement.unit)}</strong>
            </div>
            <form onSubmit={saveMovement} className={styles.form}>
              <div className={styles.movementTypes}>
                {[
                  { value: 'in', label: t('invTypeInLabel'), desc: t('invTypeInDesc') },
                  { value: 'out', label: t('invTypeOutLabel'), desc: t('invTypeOutDesc') },
                  { value: 'adjustment', label: t('invTypeAdjLabel'), desc: t('invTypeAdjDesc') },
                ].map(mt => (
                  <button
                    key={mt.value}
                    type="button"
                    className={`${styles.movementTypeBtn} ${movementForm.type === mt.value ? styles.movementTypeBtnActive : ''} ${styles[`type-${mt.value}`]}`}
                    onClick={() => setMovementForm(f => ({ ...f, type: mt.value }))}
                  >
                    <span className={styles.movementTypeBtnLabel}>{mt.label}</span>
                    <span className={styles.movementTypeBtnDesc}>{mt.desc}</span>
                  </button>
                ))}
              </div>
              <div className={styles.field}>
                <label>
                  {movementForm.type === 'adjustment' ? t('invNewQuantity') : t('invQuantity')} ({unitLabel(showMovement.unit)}) *
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
                <label>{t('hkpNote')}</label>
                <input
                  value={movementForm.note}
                  onChange={e => setMovementForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={t('invPhReasonSupplier')}
                />
              </div>
              {movementForm.quantity && (
                <div className={styles.movementPreview}>
                  {t('invResult')}: <strong>
                    {movementForm.type === 'in'
                      ? (parseFloat(showMovement.quantity) + parseFloat(movementForm.quantity || 0)).toLocaleString('sr')
                      : movementForm.type === 'out'
                      ? Math.max(0, parseFloat(showMovement.quantity) - parseFloat(movementForm.quantity || 0)).toLocaleString('sr')
                      : parseFloat(movementForm.quantity || 0).toLocaleString('sr')
                    } {unitLabel(showMovement.unit)}
                  </strong>
                </div>
              )}
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowMovement(null)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? t('saving') : t('invSaveMovement')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
