// ▶ Novi fajl: src/modules/inventory/pages/MovementsLog.jsx

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import DateNav from '../../../components/shared/DateNav'
import styles from './MovementsLog.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

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
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState(TODAY)
  const [search, setSearch] = useState('')

  const loadAll = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    const { data: movs } = await supabase
      .from('inventory_movements')
      .select('*, inventory_items(name, unit)')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', from + 'T00:00:00Z')
      .lte('created_at', to + 'T23:59:59Z')
      .order('created_at', { ascending: false })
      .limit(1000)
    setMovements(movs || [])
    setLoading(false)
  }, [restaurant, from, to])

  useEffect(() => {
    if (restaurant) loadAll()
  }, [loadAll])

  const filtered = movements.filter(m => {
    const matchType = filterType === 'all' || m.type === filterType
    const matchSearch = !search || (
      (m.inventory_items?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.note || '').toLowerCase().includes(search.toLowerCase())
    )
    return matchType && matchSearch
  })

  if (loading) return <div className={styles.loading}>Učitavanje pokreta...</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>

      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>Promjene zaliha</h1>
          <p className={gsStyles.subtitle}>Historija ulaza, izlaza i korekcija inventara.</p>
        </div>
      </div>

      <DateNav
        from={from}
        to={to}
        search={search}
        onChange={(f, t) => { setFrom(f); setTo(t) }}
        onSearch={setSearch}
        showFuture={false}
        placeholder="Pretraži stavku ili napomenu..."
      />

      {/* Filteri */}
      <div className={styles.filters}>
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
