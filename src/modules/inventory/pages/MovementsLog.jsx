// ▶ Novi fajl: src/modules/inventory/pages/MovementsLog.jsx

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import DateNav from '../../../components/shared/DateNav'
import styles from './MovementsLog.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const TODAY = new Date().toISOString().slice(0, 10)

// label preko prevodnog ključa; cls je CSS klasa po tipu pokreta.
const TYPE_MAP = {
  in:         { key: 'mlTypeIn',  cls: 'typeIn' },
  out:        { key: 'mlTypeOut', cls: 'typeOut' },
  adjustment: { key: 'mlTypeAdj', cls: 'typeAdj' },
}

const SOURCE_KEYS = {
  manual: 'mlSourceManual',
  order:  'mlSourceOrder',
}

export default function MovementsLog() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [from, setFrom] = useState(TODAY)
  const [to, setTo] = useState(TODAY)
  const [search, setSearch] = useState('')

  const loadAll = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    let movQ = supabase
      .from('inventory_movements')
      .select('*, inventory_items(name, unit)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (from) movQ = movQ.gte('created_at', from + 'T00:00:00Z')
    if (to)   movQ = movQ.lte('created_at', to + 'T23:59:59Z')
    const { data: movs } = await movQ
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

  if (loading) return <div className={styles.loading}>{t('mlLoading')}</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 960 }}>

      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>{t('mlTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('mlSubtitle')}</p>
        </div>
      </div>

      <DateNav
        from={from}
        to={to}
        search={search}
        onChange={(f, tt) => { setFrom(f); setTo(tt) }}
        onSearch={setSearch}
        showFuture={false}
        showMonth={true}
        allowAll={true}
        placeholder={t('mlSearchPlaceholder')}
      />

      {/* Filteri */}
      <div className={styles.filters}>
        <div className={styles.filterTypes}>
          {['all', 'in', 'out', 'adjustment'].map(ft => (
            <button
              key={ft}
              className={`${styles.filterBtn} ${filterType === ft ? styles.filterBtnActive : ''}`}
              onClick={() => setFilterType(ft)}
            >
              {ft === 'all' ? t('invCatAll') : t(TYPE_MAP[ft]?.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div>📋</div>
          <div>{t('mlEmpty')}</div>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(m => (
            <div key={m.id} className={styles.movRow}>
              <div className={`${styles.movType} ${styles[TYPE_MAP[m.type]?.cls]}`}>
                {t(TYPE_MAP[m.type]?.key)}
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
                <span className={styles.movSource}>{SOURCE_KEYS[m.source] ? t(SOURCE_KEYS[m.source]) : m.source}</span>
                <span className={styles.movDate}>
                  {new Date(m.created_at).toLocaleDateString(dl, { day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(m.created_at).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
