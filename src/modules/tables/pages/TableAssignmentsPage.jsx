import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './TableAssignmentsPage.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function TableAssignmentsPage() {
  const { restaurant, hasPermission } = usePlatform()
  const navigate = useNavigate()
  const { t } = useTranslation('admin')

  const [date, setDate] = useState(today())
  const [tables, setTables] = useState([])
  const [waiters, setWaiters] = useState([])
  const [assignments, setAssignments] = useState({})  // table_id → staff_id
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)               // table_id koji se snima

  const restaurantId = restaurant?.id

  // Stolovi aktivnog layouta + konobari se učitavaju jednom; dodjele po promjeni datuma.
  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('tables').select('id, number, label, seats, table_layouts!inner(is_active)')
        .eq('restaurant_id', restaurantId).eq('table_layouts.is_active', true).order('number'),
      supabase.from('staff').select('id, first_name, last_name, email, is_active, role:roles(permissions)')
        .eq('restaurant_id', restaurantId).eq('is_active', true),
    ]).then(([{ data: tbls }, { data: stf }]) => {
      if (cancelled) return
      setTables(tbls || [])
      // Samo osoblje koje smije vidjeti stolove (konobari) — pravilo iz spec §5.2.
      setWaiters((stf || []).filter(s => (s.role?.permissions || []).includes('view_tables')))
    })
    return () => { cancelled = true }
  }, [restaurantId])

  const loadAssignments = useRef(async () => {})
  loadAssignments.current = async () => {
    const { data } = await supabase.from('table_assignments')
      .select('table_id, staff_id').eq('restaurant_id', restaurantId).eq('date', date)
    const map = {}
    for (const a of data || []) map[a.table_id] = a.staff_id
    setAssignments(map)
    setLoading(false)
  }

  useEffect(() => {
    if (!restaurantId) return
    setLoading(true)
    loadAssignments.current()
  }, [restaurantId, date])

  const assignWaiter = async (tableId, staffId) => {
    setBusy(tableId)
    if (!staffId) {
      await supabase.from('table_assignments').delete()
        .eq('restaurant_id', restaurantId).eq('table_id', tableId).eq('date', date)
      setAssignments(prev => { const n = { ...prev }; delete n[tableId]; return n })
    } else {
      await supabase.from('table_assignments').upsert(
        { restaurant_id: restaurantId, table_id: tableId, staff_id: staffId, date },
        { onConflict: 'table_id,date' },
      )
      setAssignments(prev => ({ ...prev, [tableId]: staffId }))
    }
    setBusy(null)
  }

  const waiterName = (s) => {
    const full = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
    return full || s.email
  }

  if (!hasPermission('manage_tables')) {
    return <div className={styles.empty}>{t('tasNoPermission')}</div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title} style={{ margin: 0 }}>{t('tasTitle')}</h1>
          <p className={styles.subtitle}>{t('tasSubtitle')}</p>
        </div>
        <button className={styles.btnBack} onClick={() => navigate('/admin/tables/view')}>
          {t('tasBackToMap')} →
        </button>
      </div>

      <div className={styles.controls}>
        <label className={styles.dateLabel}>
          {t('tasDate')}
          <input type="date" className={styles.dateInput} value={date} onChange={e => setDate(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('tasLoading')}</div>
      ) : tables.length === 0 ? (
        <div className={styles.empty}>{t('tasNoTables')}</div>
      ) : waiters.length === 0 ? (
        <div className={styles.empty}>{t('tasNoWaiters')}</div>
      ) : (
        <div className={styles.list}>
          {tables.map(tb => (
            <div key={tb.id} className={styles.row}>
              <div className={styles.tableCell}>
                <span className={styles.tableName}>{tb.label || `${t('anaTable')} ${tb.number}`}</span>
                <span className={styles.tableSeats}>{tb.seats} {t('tblSeatsShort')}</span>
              </div>
              <select
                className={styles.waiterSelect}
                value={assignments[tb.id] || ''}
                disabled={busy === tb.id}
                onChange={e => assignWaiter(tb.id, e.target.value)}
              >
                <option value="">{t('tasUnassigned')}</option>
                {waiters.map(w => (
                  <option key={w.id} value={w.id}>{waiterName(w)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
