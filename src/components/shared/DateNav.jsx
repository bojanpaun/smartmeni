import { useState, useEffect } from 'react'
import styles from './DateNav.module.css'

const _t = new Date()
const TODAY     = _t.toISOString().slice(0, 10)
const YESTERDAY = (() => { const d = new Date(_t); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
const TOMORROW  = (() => { const d = new Date(_t); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()

export { TODAY as DATE_TODAY, YESTERDAY as DATE_YESTERDAY, TOMORROW as DATE_TOMORROW }

export default function DateNav({
  from, to, search = '', onChange, onSearch,
  showFuture = true, hidePeriod = false, placeholder = 'Pretraži...'
}) {
  const [rangeMode, setRangeMode] = useState(() => from !== to)

  useEffect(() => {
    if (from !== to && !rangeMode) setRangeMode(true)
  }, [from, to])

  const isYesterday = !rangeMode && from === YESTERDAY
  const isToday     = !rangeMode && from === TODAY
  const isTomorrow  = !rangeMode && from === TOMORROW

  const setQuick = (date) => { setRangeMode(false); onChange(date, date) }

  const togglePeriod = () => {
    if (rangeMode) { setRangeMode(false); onChange(from, from) }
    else           { setRangeMode(true) }
  }

  return (
    <div className={styles.nav}>
      <div className={styles.left}>
        <button className={`${styles.btn} ${isYesterday ? styles.active : ''}`} onClick={() => setQuick(YESTERDAY)}>Juče</button>
        <button className={`${styles.btn} ${isToday     ? styles.active : ''}`} onClick={() => setQuick(TODAY)}>Danas</button>
        {showFuture && (
          <button className={`${styles.btn} ${isTomorrow ? styles.active : ''}`} onClick={() => setQuick(TOMORROW)}>Sutra</button>
        )}
        {!rangeMode ? (
          <input type="date" className={styles.dateInput} value={from}
            onChange={e => { onChange(e.target.value, e.target.value) }} />
        ) : (
          <>
            <input type="date" className={styles.dateInput} value={from} max={to}
              onChange={e => onChange(e.target.value, to)} />
            <span className={styles.sep}>—</span>
            <input type="date" className={styles.dateInput} value={to} min={from}
              onChange={e => onChange(from, e.target.value)} />
          </>
        )}
        {!hidePeriod && (
          <button className={`${styles.btn} ${rangeMode ? styles.active : ''}`} onClick={togglePeriod}>Period</button>
        )}
      </div>
      <div className={styles.right}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input type="text" className={styles.searchInput} value={search}
            onChange={e => onSearch(e.target.value)} placeholder={placeholder} />
          {search && <button className={styles.clearBtn} onClick={() => onSearch('')}>✕</button>}
        </div>
      </div>
    </div>
  )
}
