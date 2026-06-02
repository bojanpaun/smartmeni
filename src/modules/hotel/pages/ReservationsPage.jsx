import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useReservations } from '../hooks/useReservations'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import SortableHead from '../../../components/shared/SortableHead'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { useSortable } from '../../../hooks/useSortable'
import styles from './Hotel.module.css'
import navStyles from '../../../styles/nav.module.css'

// ── Helpers ────────────────────────────────────────────────────
const toDate = (d) => new Date(d).toISOString().slice(0, 10)
const TODAY   = DATE_TODAY
const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd }
const isToday   = (d) => toDate(d) === TODAY
const isWeekend = (d) => new Date(d).getDay() === 0 || new Date(d).getDay() === 6
const DAYS = 14

function getMondayOf(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}


// ── Status mape ────────────────────────────────────────────────
const STATUS_COLORS = {
  inquiry: '#8a9e96', confirmed: '#0d7a52', checked_in: '#1a2e26',
  checked_out: '#5a7a6a', cancelled: '#a32d2d', no_show: '#ba7517',
}
const STATUS_LABELS = {
  inquiry: 'Upit', confirmed: 'Potvrđena', checked_in: 'Prisutna',
  checked_out: 'Odjavljena', cancelled: 'Otkazana', no_show: 'No-show',
}
const STATUS_FILTERS = ['', 'confirmed', 'checked_in', 'checked_out', 'cancelled']

const CAL_STYLE = {
  inquiry:     { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  confirmed:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  checked_in:  { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  checked_out: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
}
const CAL_LABELS = {
  inquiry: 'Upit', confirmed: 'Potvrđena', checked_in: 'Prisutna', checked_out: 'Odjavljena',
}

// ── Komponenta ─────────────────────────────────────────────────
export default function ReservationsPage() {
  const { restaurant } = usePlatform()
  const navigate = useNavigate()
  const [view, setView] = useState('list')

  // ── List state ─────────────────────────────────────────────
  const [from, setFrom] = useState(DATE_TODAY)
  const [to, setTo]     = useState(DATE_TODAY)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const { sortBy, sortDir, onSort, sort } = useSortable('check_in_date')

  const { reservations, loading } = useReservations(restaurant?.id, {
    status:       statusFilter || undefined,
    checkInFrom:  from || undefined,
    checkInTo:    to   || undefined,
  })

  const filteredReservations = reservations.filter(res => {
    if (!search) return true
    const q = search.toLowerCase()
    return (res.guest_name || '').toLowerCase().includes(q) ||
           String(res.rooms?.room_number || '').toLowerCase().includes(q)
  })

  // ── Calendar state ─────────────────────────────────────────
  const [calStart, setCalStart] = useState(() => getMondayOf(new Date()))
  const [calSearch, setCalSearch] = useState('')
  const [calReservations, setCalReservations] = useState([])
  const [calLoading, setCalLoading] = useState(false)
  const { rooms, loading: roomsLoading } = useRooms(restaurant?.id)

  const calDates    = Array.from({ length: DAYS }, (_, i) => addDays(calStart, i))
  const calRangeStart = toDate(calStart)
  const calRangeEnd   = toDate(addDays(calStart, DAYS - 1))

  useEffect(() => {
    if (view !== 'calendar' || !restaurant?.id) return
    setCalLoading(true)
    supabase
      .from('hotel_reservations')
      .select('id, guest_name, room_id, check_in_date, check_out_date, status')
      .eq('restaurant_id', restaurant.id)
      .lte('check_in_date', calRangeEnd)
      .gt('check_out_date', calRangeStart)
      .not('status', 'in', '(cancelled,no_show)')
      .then(({ data }) => { setCalReservations(data ?? []); setCalLoading(false) })
  }, [view, restaurant?.id, calRangeStart, calRangeEnd])

  const resByRoom = calReservations.reduce((acc, r) => {
    if (r.room_id) { if (!acc[r.room_id]) acc[r.room_id] = []; acc[r.room_id].push(r) }
    return acc
  }, {})

  const getResStyle = (res) => {
    const ci     = new Date(res.check_in_date  + 'T00:00:00')
    const co     = new Date(res.check_out_date + 'T00:00:00')
    const origin = calStart.getTime()
    const startDay = Math.max(0,    (ci.getTime() - origin) / 86400000)
    const endDay   = Math.min(DAYS, (co.getTime() - origin) / 86400000)
    return {
      left:  `calc(${(startDay / DAYS) * 100}% + 2px)`,
      width: `calc(${((endDay - startDay) / DAYS) * 100}% - 4px)`,
    }
  }

  const calShift = (n) => setCalStart(d => addDays(d, n * 7))

  const filteredRooms = rooms.filter(room => {
    if (!calSearch) return true
    const q = calSearch.toLowerCase()
    return String(room.room_number || '').toLowerCase().includes(q) ||
           (room.room_types?.name || '').toLowerCase().includes(q)
  })

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rezervacije</h1>
          <p className={styles.subtitle}>
            {view === 'list'
              ? `${filteredReservations.length} rezervacija`
              : `${calDates[0].toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long' })} — ${calDates[DAYS - 1].toLocaleDateString('sr-Latn', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={navStyles.toggleBar}>
            <button
              className={view === 'list' ? navStyles.toggleBtnActive : navStyles.toggleBtn}
              onClick={() => setView('list')}
            >☰ Lista</button>
            <button
              className={view === 'calendar' ? navStyles.toggleBtnActive : navStyles.toggleBtn}
              onClick={() => setView('calendar')}
            >📆 Kalendar</button>
          </div>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
            + Nova rezervacija
          </button>
        </div>
      </div>

      {/* ══ LIST VIEW ══ */}
      {view === 'list' && (
        <>
          {/* DateNav — Juče/Danas/Sutra/Mjesec/Period/Sve + pretraga */}
          <DateNav
            from={from}
            to={to}
            search={search}
            onChange={(f, t) => { setFrom(f); setTo(t) }}
            onSearch={setSearch}
            showFuture={true}
            showMonth={true}
            allowAll={true}
            placeholder="Pretraži gosta ili sobu..."
          />

          {/* Status filter */}
          <div className={styles.filterBar}>
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? STATUS_LABELS[s] : 'Svi statusi'}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : filteredReservations.length === 0 ? (
            <div className={styles.empty}><p>Nema rezervacija za odabrani period.</p></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <SortableHead col="guest_name"           label="Gost"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableHead col="rooms.room_number"    label="Soba"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableHead col="check_in_date"        label="Check-in"  sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableHead col="check_out_date"       label="Check-out" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <span>Noći</span>
                <SortableHead col="total_amount"         label="Iznos"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <SortableHead col="status"               label="Status"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              </div>
              {sort(filteredReservations).map(res => {
                const nights = Math.ceil((new Date(res.check_out_date) - new Date(res.check_in_date)) / 86400000)
                return (
                  <div key={res.id} className={styles.tableRow} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)}>
                    <span className={styles.bold}>{res.guest_name}</span>
                    <span>{res.rooms?.room_number ?? res.room_types?.name ?? '—'}</span>
                    <span>{new Date(res.check_in_date).toLocaleDateString('sr-Latn')}</span>
                    <span>{new Date(res.check_out_date).toLocaleDateString('sr-Latn')}</span>
                    <span>{nights}</span>
                    <span>{res.total_amount ? `€${Number(res.total_amount).toFixed(0)}` : '—'}</span>
                    <span>
                      <span style={{
                        color: STATUS_COLORS[res.status],
                        fontSize: 12, fontWeight: 600,
                        padding: '2px 8px',
                        background: STATUS_COLORS[res.status] + '18',
                        borderRadius: 20,
                      }}>
                        {STATUS_LABELS[res.status] ?? res.status}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══ CALENDAR VIEW ══ */}
      {view === 'calendar' && (
        <>
          {/* Kalendar navigacija */}
          <div className={styles.calNavRow}>
            <button className={styles.btnSecondary} onClick={() => calShift(-2)}>«</button>
            <button className={styles.btnSecondary} onClick={() => calShift(-1)}>‹ Nazad</button>
            <button className={styles.btnSecondary} onClick={() => { setCalStart(getMondayOf(new Date())) }}>Danas</button>
            <button className={styles.btnSecondary} onClick={() => calShift(1)}>Naprijed ›</button>
            <button className={styles.btnSecondary} onClick={() => calShift(2)}>»</button>
            <input
              className={styles.searchInput}
              placeholder="Pretraži sobu..."
              value={calSearch}
              onChange={e => setCalSearch(e.target.value)}
            />
          </div>

          {calLoading || roomsLoading ? <LoadingSpinner /> : rooms.length === 0 ? (
            <div className={styles.empty}>
              <p>Nema soba. Dodajte sobe u upravljanju sobama.</p>
              <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms')}>Upravljanje sobama</button>
            </div>
          ) : (
            <div className={styles.calendarWrap}>
              {/* Header */}
              <div className={styles.calendarHeader}>
                <div className={styles.calendarRoomHeader}>Soba</div>
                {calDates.map(d => (
                  <div
                    key={toDate(d)}
                    className={[
                      styles.calendarDayHeader,
                      isToday(d)   ? styles.calendarDayHeaderToday   : '',
                      isWeekend(d) ? styles.calendarDayHeaderWeekend : '',
                    ].join(' ')}
                  >
                    <span className={styles.calendarDayName}>{new Date(d).toLocaleDateString('sr-Latn', { weekday: 'short' })}</span>
                    <span className={styles.calendarDayNum}>{new Date(d).getDate()}</span>
                    <span className={styles.calendarMonthLabel}>
                      {new Date(d).getDate() === 1 || d === calDates[0]
                        ? new Date(d).toLocaleDateString('sr-Latn', { month: 'short' }) : ''}
                    </span>
                  </div>
                ))}
              </div>

              {/* Redovi soba */}
              {filteredRooms.map(room => (
                <div key={room.id} className={styles.calendarRow}>
                  <div className={styles.calendarRoomLabel}>
                    <div className={styles.calendarRoomNum}>{room.room_number}</div>
                    {room.room_types?.name && <div className={styles.calendarRoomType}>{room.room_types.name}</div>}
                  </div>
                  <div className={styles.calendarTimeline}>
                    {calDates.map(d => (
                      <div
                        key={toDate(d)}
                        className={[
                          styles.calendarDaySlot,
                          isToday(d)   ? styles.calendarSlotToday   : '',
                          isWeekend(d) ? styles.calendarSlotWeekend : '',
                        ].join(' ')}
                        onClick={() => navigate('/admin/hotel/reservations/new')}
                        title={`Dodaj rezervaciju — soba ${room.room_number}`}
                      />
                    ))}
                    {(resByRoom[room.id] ?? []).map(res => {
                      const s = CAL_STYLE[res.status] ?? CAL_STYLE.confirmed
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

              {/* Legenda */}
              <div className={styles.calendarLegend}>
                {Object.entries(CAL_STYLE).map(([status, s]) => (
                  <div key={status} className={styles.calendarLegendItem}>
                    <span className={styles.calendarLegendDot} style={{ background: s.bg, borderColor: s.border }} />
                    <span>{CAL_LABELS[status]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
