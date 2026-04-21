// ▶ Novi fajl: src/modules/inventory/pages/MovementsLog.jsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './MovementsLog.module.css'

const TYPE_MAP = {
  in:         { label: 'Ulaz',      cls: 'typeIn' },
  out:        { label: 'Izlaz',     cls: 'typeOut' },
  adjustment: { label: 'Korekcija', cls: 'typeAdj' },
}

const SOURCE_MAP = {
  manual: 'Ručno',
  order:  'Narudžba',
}

export default function MovementsLog() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()

  const [movements, setMovements] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterItem, setFilterItem] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    if (restaurant) loadAll()
  }, [restaurant])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: movs }, { data: itms }] = await Promise.all([
      supabase
        .from('inventory_movements')
        .select('*, inventory_items(name, unit)')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('inventory_items')
        .select('id, name')
        .eq('restaurant_id', restaurant.id)
        .order('name'),
    ])
    setMovements(movs || [])
    setItems(itms || [])
    setLoading(false)
  }

  const filtered = movements.filter(m => {
    const matchItem = !filterItem || m.item_id === filterItem
    const matchType = filterType === 'all' || m.type === filterType
    const matchDate = !filterDate || m.created_at.startsWith(filterDate)
    return matchItem && matchType && matchDate
  })

  if (loading) return <div className={styles.loading}>Učitavanje pokreta...</div>

  return (
    <div className={styles.wrap}>

      <div className={styles.header}>
        <div className={styles.headerTitle}>Pokreti zaliha</div>
        <button className={styles.btnBack} onClick={() => navigate('/admin/inventory')}>
          ← Inventar
        </button>
      </div>

      {/* Filteri */}
      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={filterItem}
          onChange={e => setFilterItem(e.target.value)}
        >
          <option value="">Sve stavke</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>

        <div className={styles.filterTypes}>
          {['all', 'in', 'out', 'adjustment'].map(t => (
            <button
              key={t}
              className={`${styles.filterBtn} ${filterType === t ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'Sve' : TYPE_MAP[t]?.label}
            </button>
          ))}
        </div>

        <input
          type="date"
          className={styles.filterDate}
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
        />
        {filterDate && (
          <button className={styles.filterClear} onClick={() => setFilterDate('')}>✕</button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div>📋</div>
          <div>Nema pokreta za odabrane filtere.</div>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(m => (
            <div key={m.id} className={styles.movRow}>
              <div className={`${styles.movType} ${styles[TYPE_MAP[m.type]?.cls]}`}>
                {TYPE_MAP[m.type]?.label}
              </div>
              <div className={styles.movMain}>
                <div className={styles.movName}>{m.inventory_items?.name || '—'}</div>
                {m.note && <div className={styles.movNote}>{m.note}</div>}
              </div>
              <div className={styles.movQty}>
                <span className={`${styles.movQtyNum} ${styles[`qty-${m.type}`]}`}>
                  {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                  {parseFloat(m.quantity).toLocaleString('sr')} {m.inventory_items?.unit}
                </span>
                <span className={styles.movQtyAfter}>
                  → {parseFloat(m.quantity_after ?? 0).toLocaleString('sr')} {m.inventory_items?.unit}
                </span>
              </div>
              <div className={styles.movMeta}>
                <span className={styles.movSource}>{SOURCE_MAP[m.source] || m.source}</span>
                <span className={styles.movDate}>
                  {new Date(m.created_at).toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(m.created_at).toLocaleTimeString('sr', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
