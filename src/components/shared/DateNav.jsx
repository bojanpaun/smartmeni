import { useState, useEffect } from 'react'
import styles from './DateNav.module.css'

const _t = new Date()
const TODAY     = _t.toISOString().slice(0, 10)
const YESTERDAY = (() => { const d = new Date(_t); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
const TOMORROW  = (() => { const d = new Date(_t); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()

export { TODAY as DATE_TODAY, YESTERDAY as DATE_YESTERDAY, TOMORROW as DATE_TOMORROW }

export default function DateNav({
  from, to, search = '', onChange, onSearch,
  showFuture = true,
  hidePeriod = false,
  showMonth  = false,   // dugme Mjesec + month picker
  allowAll   = false,   // dugme Sve (briše datumski filter)
  placeholder = 'Pretraži...',
}) {
  const isAll = from == null && to == null

  // month picker ili range ili single
  const [monthMode, setMonthMode] = useState(false)
  const [rangeMode, setRangeMode] = useState(() => !isAll && from !== to)

  // Sinkronizacija: ako roditelj promijeni from===to, ugasi rangeMode
  useEffect(() => {
    if (from != null && to != null && from !== to && !rangeMode) setRangeMode(true)
    if ((from == null || from === to) && rangeMode && !monthMode) setRangeMode(false)
  }, [from, to])

  const isYesterday = !rangeMode && !monthMode && !isAll && from === YESTERDAY
  const isToday     = !rangeMode && !monthMode && !isAll && from === TODAY
  const isTomorrow  = !rangeMode && !monthMode && !isAll && from === TOMORROW

  const setQuick = (date) => {
    setRangeMode(false); setMonthMode(false)
    onChange(date, date)
  }

  const setAll = () => {
    setRangeMode(false); setMonthMode(false)
    onChange(null, null)
  }

  const togglePeriod = () => {
    if (rangeMode) {
      setRangeMode(false); setMonthMode(false)
      onChange(from || TODAY, from || TODAY)
    } else {
      setRangeMode(true); setMonthMode(false)
      if (isAll) onChange(TODAY, TODAY)
    }
  }

  const toggleMonth = () => {
    if (monthMode) {
      // izlaz iz month mode → vrati na danas
      setMonthMode(false); setRangeMode(false)
      onChange(TODAY, TODAY)
    } else {
      setMonthMode(true); setRangeMode(false)
      // postavi na tekući mjesec
      const now = new Date()
      const y = now.getFullYear(), m = now.getMonth() + 1
      const first = `${y}-${String(m).padStart(2, '0')}-01`
      const last  = new Date(y, m, 0).toISOString().slice(0, 10)
      onChange(first, last)
    }
  }

  const handleMonthChange = (monthStr) => {
    if (!monthStr) return
    const [y, m] = monthStr.split('-').map(Number)
    const first = `${y}-${String(m).padStart(2, '0')}-01`
    const last  = new Date(y, m, 0).toISOString().slice(0, 10)
    onChange(first, last)
  }

  // Trenutni mjesec kao YYYY-MM (za input type=month)
  const monthValue = from ? from.slice(0, 7) : TODAY.slice(0, 7)

  return (
    <div className={styles.nav}>
      <div className={styles.left}>
        <button className={`${styles.btn} ${isYesterday ? styles.active : ''}`} onClick={() => setQuick(YESTERDAY)}>Juče</button>
        <button className={`${styles.btn} ${isToday     ? styles.active : ''}`} onClick={() => setQuick(TODAY)}>Danas</button>
        {showFuture && (
          <button className={`${styles.btn} ${isTomorrow ? styles.active : ''}`} onClick={() => setQuick(TOMORROW)}>Sutra</button>
        )}

        {/* Month picker dugme */}
        {showMonth && (
          <button className={`${styles.btn} ${monthMode ? styles.active : ''}`} onClick={toggleMonth}>Mjesec</button>
        )}

        {/* Prikaz inputa zavisno od moda */}
        {!isAll && (
          monthMode ? (
            <input
              type="month"
              className={styles.dateInput}
              value={monthValue}
              onChange={e => handleMonthChange(e.target.value)}
            />
          ) : rangeMode ? (
            <>
              <input type="date" className={styles.dateInput} value={from ?? ''} max={to ?? ''} onChange={e => onChange(e.target.value, to)} />
              <span className={styles.sep}>—</span>
              <input type="date" className={styles.dateInput} value={to   ?? ''} min={from ?? ''} onChange={e => onChange(from, e.target.value)} />
            </>
          ) : (
            <input
              type="date"
              className={styles.dateInput}
              value={from ?? ''}
              onChange={e => { onChange(e.target.value, e.target.value) }}
            />
          )
        )}

        {/* Period dugme */}
        {!hidePeriod && (
          <button className={`${styles.btn} ${rangeMode ? styles.active : ''}`} onClick={togglePeriod}>Period</button>
        )}

        {/* Sve dugme */}
        {allowAll && (
          <button className={`${styles.btn} ${isAll ? styles.active : ''}`} onClick={setAll}>Sve</button>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={placeholder}
          />
          {search && <button className={styles.clearBtn} onClick={() => onSearch('')}>✕</button>}
        </div>
      </div>
    </div>
  )
}
