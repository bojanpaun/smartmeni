import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const DAYS = 14

const toStr = (d) => d.toISOString().slice(0, 10)

const addDays = (d, n) => {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

const isToday = (d) => toStr(d) === toStr(new Date())
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6

const STATUS_STYLE = {
  inquiry:     { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  confirmed:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  checked_in:  { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  checked_out: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
}

const STATUS_LABEL = {
  inquiry: 'Upit',
  confirmed: 'Potvrđena',
  checked_in: 'Prisutna',
  checked_out: 'Odjavljena',
}

function getMondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

export default function CalendarPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const { rooms, loading: roomsLoading } = useRooms(restaurant?.id)

  const [startDate, setStartDate] = useState(() => getMondayOf(new Date()))
  const [reservations, setReservations] = useState([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [navFrom, setNavFrom] = useState(DATE_TODAY)
  const [search, setSearch] = useState('')

  const dates = Array.from({ length: DAYS }, (_, i) => addDays(startDate, i))
  const rangeStart = toStr(startDate)
  const rangeEnd = toStr(addDays(startDate, DAYS - 1))

  useEffect(() => {
    if (!restaurant?.id) return
    setLoadingRes(true)
    supabase
      .from('hotel_reservations')
      .select('id, guest_name, room_id, check_in_date, check_out_date, status')
      .eq('restaurant_id', restaurant.id)
      .lte('check_in_date', rangeEnd)
      .gt('check_out_date', rangeStart)
      .not('status', 'in', '(cancelled,no_show)')
      .then(({ data }) => {
        setReservations(data ?? [])
        setLoadingRes(false)
      })
  }, [restaurant?.id, rangeStart, rangeEnd])

  const resByRoom = reservations.reduce((acc, r) => {
    if (r.room_id) {
      if (!acc[r.room_id]) acc[r.room_id] = []
      acc[r.room_id].push(r)
    }
    return acc
  }, {})

  const getResStyle = (res) => {
    const checkIn = new Date(res.check_in_date + 'T00:00:00')
    const checkOut = new Date(res.check_out_date + 'T00:00:00')
    const origin = startDate.getTime()

    const startDay = Math.max(0, (checkIn.getTime() - origin) / 86400000)
    const endDay   = Math.min(DAYS, (checkOut.getTime() - origin) / 86400000)

    return {
      left:  `calc(${(startDay / DAYS) * 100}% + 2px)`,
      width: `calc(${((endDay - startDay) / DAYS) * 100}% - 4px)`,
    }
  }

  const shift = (n) => setStartDate(d => addDays(d, n * 7))

  const loading = roomsLoading || loadingRes

  const filteredRooms = rooms.filter(room => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(room.room_number || '').toLowerCase().includes(q) ||
      (room.room_types?.name || '').toLowerCase().includes(q)
    )
  })

  const handleNavChange = (f) => {
    setNavFrom(f)
    setStartDate(getMondayOf(new Date(f + 'T12:00:00')))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Kalendar dostupnosti</h1>
          <p className={styles.subtitle}>
            {dates[0].toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })}
            {' — '}
            {dates[DAYS - 1].toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => shift(-2)}>«</button>
          <button className={styles.btnSecondary} onClick={() => shift(-1)}>‹ Nazad</button>
          <button className={styles.btnSecondary} onClick={() => { setStartDate(getMondayOf(new Date())); setNavFrom(DATE_TODAY) }}>Danas</button>
          <button className={styles.btnSecondary} onClick={() => shift(1)}>Naprijed ›</button>
          <button className={styles.btnSecondary} onClick={() => shift(2)}>»</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
            + Nova rezervacija
          </button>
        </div>
      </div>

      <DateNav
        from={navFrom}
        to={navFrom}
        search={search}
        onChange={(f) => handleNavChange(f)}
        onSearch={setSearch}
        showFuture={true}
        hidePeriod={true}
        placeholder="Pretraži sobu..."
      />

      {loading ? <LoadingSpinner /> : rooms.length === 0 ? (
        <div className={styles.empty}>
          <p>Nema soba. Dodajte sobe u upravljanju sobama.</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms')}>
            Upravljanje sobama
          </button>
        </div>
      ) : (
        <div className={styles.calendarWrap}>
          {/* Header row */}
          <div className={styles.calendarHeader}>
            <div className={styles.calendarRoomHeader}>Soba</div>
            {dates.map(d => (
              <div
                key={toStr(d)}
                className={[
                  styles.calendarDayHeader,
                  isToday(d) ? styles.calendarDayHeaderToday : '',
                  isWeekend(d) ? styles.calendarDayHeaderWeekend : '',
                ].join(' ')}
              >
                <span className={styles.calendarDayName}>
                  {d.toLocaleDateString('sr-Latn', { weekday: 'short' })}
                </span>
                <span className={styles.calendarDayNum}>{d.getDate()}</span>
                <span className={styles.calendarMonthLabel}>
                  {d.getDate() === 1 || d === dates[0]
                    ? d.toLocaleDateString('sr-Latn', { month: 'short' })
                    : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Room rows */}
          {filteredRooms.map(room => (
            <div key={room.id} className={styles.calendarRow}>
              <div className={styles.calendarRoomLabel}>
                <div className={styles.calendarRoomNum}>{room.room_number}</div>
                {room.room_types?.name && (
                  <div className={styles.calendarRoomType}>{room.room_types.name}</div>
                )}
              </div>
              <div className={styles.calendarTimeline}>
                {/* Background day slots */}
                {dates.map(d => (
                  <div
                    key={toStr(d)}
                    className={[
                      styles.calendarDaySlot,
                      isToday(d) ? styles.calendarSlotToday : '',
                      isWeekend(d) ? styles.calendarSlotWeekend : '',
                    ].join(' ')}
                    onClick={() => navigate('/admin/hotel/reservations/new')}
                    title={`Dodaj rezervaciju — soba ${room.room_number}, ${toStr(d)}`}
                  />
                ))}
                {/* Reservation bars */}
                {(resByRoom[room.id] ?? []).map(res => {
                  const s = STATUS_STYLE[res.status] ?? STATUS_STYLE.confirmed
                  return (
                    <div
                      key={res.id}
                      className={styles.calendarResBar}
                      style={{ ...getResStyle(res), background: s.bg, color: s.color, borderColor: s.border }}
                      onClick={e => { e.stopPropagation(); navigate(`/admin/hotel/reservations/${res.id}`) }}
                      title={`${res.guest_name} · ${res.check_in_date} → ${res.check_out_date}`}
                    >
                      <span className={styles.calendarResName}>{res.guest_name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className={styles.calendarLegend}>
            {Object.entries(STATUS_STYLE).map(([status, s]) => (
              <div key={status} className={styles.calendarLegendItem}>
                <span className={styles.calendarLegendDot} style={{ background: s.bg, borderColor: s.border }} />
                <span>{STATUS_LABEL[status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
