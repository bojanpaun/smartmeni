import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useAssets } from '../hooks/useAssets'
import { useBookings } from '../hooks/useBookings'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './CalendarPage.module.css'

const DAYS = 21
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export default function CalendarPage() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const navigate = useNavigate()
  const { assets, loading: la } = useAssets(restaurant?.id)
  const { bookings, loading: lb } = useBookings(restaurant?.id)
  const [start, setStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start])
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'

  // Mapa zauzetosti: `${asset_id}|${YYYY-MM-DD}` → booking (ne-otkazani), half-open [start,end).
  const occ = useMemo(() => {
    const m = new Map()
    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      let d = new Date(b.start_date)
      const end = new Date(b.end_date)
      while (d < end) { m.set(`${b.asset_id}|${iso(d)}`, b); d = addDays(d, 1) }
    }
    return m
  }, [bookings])

  if (la || lb) return <LoadingSpinner fullPage />

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <button className={styles.btnBack} onClick={() => navigate('/admin/rental')}>← {t('modRental')}</button>
          <h1 className={styles.title}>{t('rcTitle')}</h1>
          <p className={styles.subtitle}>{t('rcSubtitle')}</p>
        </div>
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={() => setStart(s => addDays(s, -DAYS))}>‹</button>
          <button className={styles.navBtn} onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setStart(d) }}>{t('rcToday')}</button>
          <button className={styles.navBtn} onClick={() => setStart(s => addDays(s, DAYS))}>›</button>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className={styles.empty}>{t('rpNoAssets')}</div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.cornerCell}></th>
                {days.map(d => {
                  const wd = d.toLocaleDateString(dl, { weekday: 'short' })
                  const isWe = d.getDay() === 0 || d.getDay() === 6
                  return <th key={iso(d)} className={`${styles.dayHead} ${isWe ? styles.weekend : ''}`}>
                    <span className={styles.dayWd}>{wd}</span>
                    <span className={styles.dayNum}>{d.getDate()}</span>
                  </th>
                })}
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id}>
                  <th className={styles.assetCell} title={a.name}>{a.name}</th>
                  {days.map(d => {
                    const b = occ.get(`${a.id}|${iso(d)}`)
                    const isWe = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <td key={iso(d)}
                        className={`${styles.cell} ${isWe ? styles.weekend : ''} ${b ? styles.booked : ''} ${b?.status === 'checked_in' ? styles.inhouse : ''}`}
                        title={b ? `${b.guest_name} (${b.start_date} → ${b.end_date})` : ''}
                        onClick={() => navigate('/admin/rental/bookings')}>
                        {b ? <span className={styles.dot} /> : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
