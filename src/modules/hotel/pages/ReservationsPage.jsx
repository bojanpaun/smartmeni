import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../../context/PlatformContext'
import { useReservations } from '../hooks/useReservations'
import { useReservationCounts } from '../hooks/useReservationCounts'
import { useRooms } from '../hooks/useRooms'
import { supabase } from '../../../lib/supabase'
import DateNav, { DATE_TODAY } from '../../../components/shared/DateNav'
import SortableHead from '../../../components/shared/SortableHead'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { useSortable } from '../../../hooks/useSortable'
import styles from './Hotel.module.css'
import navStyles from '../../../styles/nav.module.css'
import dnStyles from '../../../components/shared/DateNav.module.css'

// ── Helpers ──────────────────────────────────────────────────────
const toDate   = (d) => new Date(d).toISOString().slice(0, 10)
const TODAY    = DATE_TODAY
const addDays  = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd }
const isToday  = (d) => toDate(d) === TODAY
const isWeekend = (d) => new Date(d).getDay() === 0 || new Date(d).getDay() === 6

function getMondayOf(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function getFirstOfMonth(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

// Broj dana i start alignment po granularnosti
function calConfig(granularity, start, periodFrom, periodTo) {
  if (granularity === 'day')    return { days: 1 }
  if (granularity === 'week')   return { days: 7 }
  if (granularity === 'month')  return { days: daysInMonth(start) }
  if (granularity === 'period') {
    const d1 = new Date(periodFrom + 'T00:00:00')
    const d2 = new Date(periodTo   + 'T00:00:00')
    return { days: Math.max(1, Math.min(90, Math.ceil((d2 - d1) / 86400000) + 1)) }
  }
  return { days: 7 }
}

function shiftStart(granularity, start, dir) {
  if (granularity === 'day')  return addDays(start, dir)
  if (granularity === 'week') return addDays(start, dir * 7)
  // month
  const d = new Date(start)
  return new Date(d.getFullYear(), d.getMonth() + dir, 1)
}

function alignStart(granularity) {
  if (granularity === 'day')   return new Date(TODAY + 'T00:00:00')
  if (granularity === 'week')  return getMondayOf(new Date())
  return getFirstOfMonth(new Date())
}

// ── Status mape ──────────────────────────────────────────────────
const STATUS_CLASS = {
  inquiry:     'sBadgeInquiry',
  confirmed:   'sBadgeConfirmed',
  checked_in:  'sBadgeCheckedIn',
  checked_out: 'sBadgeCheckedOut',
  cancelled:   'sBadgeCancelled',
  no_show:     'sBadgeNoShow',
}
const STATUS_LABELS = {
  inquiry: 'Upit', confirmed: 'Potvrđena', checked_in: 'Prisutna',
  checked_out: 'Odjavljena', cancelled: 'Otkazana', no_show: 'No-show',
}
const STATUS_FILTERS = ['', 'inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled']

const CAL_STYLE = {
  inquiry:     { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  confirmed:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  checked_in:  { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  checked_out: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
}
const CAL_LABELS = {
  inquiry: 'Upit', confirmed: 'Potvrđena', checked_in: 'Prisutna', checked_out: 'Odjavljena',
}

const GRANULARITIES = [
  { key: 'day',    label: 'Dan'     },
  { key: 'week',   label: 'Sedmica' },
  { key: 'month',  label: 'Mjesec'  },
  { key: 'period', label: 'Period'  },
]

// ── Komponenta ───────────────────────────────────────────────────
export default function ReservationsPage() {
  const { restaurant } = usePlatform()
  const navigate       = useNavigate()
  const [view, setView] = useState('list')

  // ── List state ────────────────────────────────────────────────
  const [from, setFrom]               = useState(DATE_TODAY)
  const [to,   setTo]                 = useState(DATE_TODAY)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]           = useState('')
  const { sortBy, sortDir, onSort, sort } = useSortable('check_in_date')

  const { reservations, loading } = useReservations(restaurant?.id, {
    status:      statusFilter || undefined,
    checkInFrom: from || undefined,
    checkInTo:   to   || undefined,
  })

  const statusCounts = useReservationCounts(restaurant?.id, {
    checkInFrom: from || undefined,
    checkInTo:   to   || undefined,
  })

  const filteredReservations = reservations.filter(res => {
    if (!search) return true
    const q = search.toLowerCase()
    return (res.guest_name || '').toLowerCase().includes(q) ||
           String(res.rooms?.room_number || '').toLowerCase().includes(q)
  })

  // ── Calendar state ────────────────────────────────────────────
  const [calGranularity, setCalGranularity]   = useState('week')
  const [calStart, setCalStart]               = useState(() => getMondayOf(new Date()))
  const [calPeriodFrom, setCalPeriodFrom]     = useState(DATE_TODAY)
  const [calPeriodTo,   setCalPeriodTo]       = useState(DATE_TODAY)
  const [calSearch, setCalSearch]             = useState('')
  const [calReservations, setCalReservations] = useState([])
  const [calLoading, setCalLoading]           = useState(false)
  const { rooms, loading: roomsLoading }      = useRooms(restaurant?.id)

  const { days: CAL_DAYS } = useMemo(
    () => calConfig(calGranularity, calStart, calPeriodFrom, calPeriodTo),
    [calGranularity, calStart, calPeriodFrom, calPeriodTo]
  )

  // Za period mode, start je calPeriodFrom; za ostale je calStart
  const calEffectiveStart = useMemo(
    () => calGranularity === 'period' ? new Date(calPeriodFrom + 'T00:00:00') : calStart,
    [calGranularity, calStart, calPeriodFrom]
  )

  const calDates      = useMemo(() => Array.from({ length: CAL_DAYS }, (_, i) => addDays(calEffectiveStart, i)), [calEffectiveStart, CAL_DAYS])
  const calRangeStart = toDate(calEffectiveStart)
  const calRangeEnd   = toDate(addDays(calEffectiveStart, CAL_DAYS - 1))

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

  const resByRoom = useMemo(() => calReservations.reduce((acc, r) => {
    if (r.room_id) { if (!acc[r.room_id]) acc[r.room_id] = []; acc[r.room_id].push(r) }
    return acc
  }, {}), [calReservations])

  const getResStyle = (res) => {
    const ci     = new Date(res.check_in_date  + 'T00:00:00')
    const co     = new Date(res.check_out_date + 'T00:00:00')
    const origin = calEffectiveStart.getTime()
    const startDay = Math.max(0,        (ci.getTime() - origin) / 86400000)
    const endDay   = Math.min(CAL_DAYS, (co.getTime() - origin) / 86400000)
    return {
      left:  `calc(${(startDay / CAL_DAYS) * 100}% + 2px)`,
      width: `calc(${((endDay - startDay) / CAL_DAYS) * 100}% - 4px)`,
    }
  }

  const handleGranularityChange = (g) => {
    if (g === 'all') { setCalGranularity('week'); setCalStart(getMondayOf(new Date())); return }
    setCalGranularity(g)
    if (g !== 'period') setCalStart(alignStart(g))
    else { setCalPeriodFrom(DATE_TODAY); setCalPeriodTo(DATE_TODAY) }
  }

  const handleCalShift = (dir) => {
    if (calGranularity === 'period') return
    setCalStart(s => shiftStart(calGranularity, s, dir))
  }

  const goToday = () => {
    if (calGranularity === 'period') return
    setCalStart(alignStart(calGranularity))
  }

  const filteredRooms = rooms.filter(room => {
    if (!calSearch) return true
    const q = calSearch.toLowerCase()
    return String(room.room_number || '').toLowerCase().includes(q) ||
           (room.room_types?.name || '').toLowerCase().includes(q)
  })

  // Subtitle za kalendar
  const calSubtitle = useMemo(() => {
    if (!calDates.length) return ''
    const first = calDates[0]
    const last  = calDates[CAL_DAYS - 1]
    if (calGranularity === 'day') {
      return new Date(first).toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (calGranularity === 'month') {
      return new Date(first).toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' })
    }
    return `${new Date(first).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' })} — ${new Date(last).toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [calDates, calGranularity, CAL_DAYS])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Rezervacije</h1>
          <p className={styles.subtitle}>
            {view === 'list' ? `${filteredReservations.length} rezervacija` : calSubtitle}
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* Toggle Lista / Kalendar — uvijek toggleBtn + opciono toggleBtnActive */}
          <div className={navStyles.toggleBar}>
            <button
              className={`${navStyles.toggleBtn} ${view === 'list'     ? navStyles.toggleBtnActive : ''}`}
              onClick={() => setView('list')}
            >☰ Lista</button>
            <button
              className={`${navStyles.toggleBtn} ${view === 'calendar' ? navStyles.toggleBtnActive : ''}`}
              onClick={() => setView('calendar')}
            >📆 Kalendar</button>
          </div>
          <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/reservations/new')}>
            + Nova rezervacija
          </button>
        </div>
      </div>

      {/* ══ LIST VIEW ══════════════════════════════════════════ */}
      {view === 'list' && (
        <>
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

          <div className={styles.filterBar}>
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? STATUS_LABELS[s] : 'Svi statusi'}
                {statusCounts[s] > 0 && (
                  <span className={styles.filterCount}>{statusCounts[s]}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : filteredReservations.length === 0 ? (
            <div className={styles.empty}><p>Nema rezervacija za odabrani period.</p></div>
          ) : (<>
            {/* Desktop */}
            <div className={styles.fdDesktopTable}>
              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <SortableHead col="guest_name"        label="Gost"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortableHead col="rooms.room_number" label="Soba"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortableHead col="check_in_date"     label="Check-in"  sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortableHead col="check_out_date"    label="Check-out" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <span>Noći</span>
                  <SortableHead col="total_amount"      label="Iznos"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortableHead col="status"            label="Status"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
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
                      <span><span className={`${styles.sBadge} ${styles[STATUS_CLASS[res.status] ?? 'sBadgeConfirmed']}`}>{STATUS_LABELS[res.status] ?? res.status}</span></span>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Mobile */}
            <div className={styles.fdMobileList}>
              {sort(filteredReservations).map(res => {
                const nights = Math.ceil((new Date(res.check_out_date) - new Date(res.check_in_date)) / 86400000)
                return (
                  <div key={res.id} className={styles.fdCard} onClick={() => navigate(`/admin/hotel/reservations/${res.id}`)} style={{ cursor: 'pointer' }}>
                    <div className={styles.fdCardTop}>
                      <div className={styles.fdCardGuest}>{res.guest_name}</div>
                      <span className={`${styles.sBadge} ${styles[STATUS_CLASS[res.status] ?? 'sBadgeConfirmed']}`}>{STATUS_LABELS[res.status] ?? res.status}</span>
                    </div>
                    {(res.rooms?.room_number || res.room_types?.name) && (
                      <div className={styles.fdCardRoom} style={{ alignSelf: 'flex-start' }}>
                        {res.rooms?.room_number ? `Soba ${res.rooms.room_number}` : res.room_types?.name}
                      </div>
                    )}
                    <div className={styles.fdCardMeta}>
                      <span>↓ {new Date(res.check_in_date).toLocaleDateString('sr-Latn')}</span>
                      <span>↑ {new Date(res.check_out_date).toLocaleDateString('sr-Latn')}</span>
                      <span>{nights} noći</span>
                      {res.total_amount && <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>€{Number(res.total_amount).toFixed(0)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}
        </>
      )}

      {/* ══ CALENDAR VIEW ══════════════════════════════════════ */}
      {view === 'calendar' && (
        <>
          {/* Kontrolna traka — isti stil kao DateNav na listi */}
          <div className={dnStyles.nav}>
            <div className={dnStyles.left}>
              {/* Granularnost: Dan | Sedmica | Miesec (bez Period i Sve ovdje) */}
              {GRANULARITIES.filter(g => g.key !== 'period').map(g => (
                <button
                  key={g.key}
                  className={`${dnStyles.btn} ${calGranularity === g.key ? dnStyles.active : ''}`}
                  onClick={() => handleGranularityChange(g.key)}
                >
                  {g.label}
                </button>
              ))}

              {/* Picker za Miesec */}
              {calGranularity === 'month' && (
                <input
                  type="month"
                  className={dnStyles.dateInput}
                  value={toDate(calStart).slice(0, 7)}
                  onChange={e => {
                    if (!e.target.value) return
                    const [y, m] = e.target.value.split('-').map(Number)
                    setCalStart(new Date(y, m - 1, 1))
                  }}
                />
              )}

              {/* Inputs za Period */}
              {calGranularity === 'period' && (
                <>
                  <input
                    type="date"
                    className={dnStyles.dateInput}
                    value={calPeriodFrom}
                    max={calPeriodTo}
                    onChange={e => setCalPeriodFrom(e.target.value)}
                  />
                  <span className={dnStyles.sep}>—</span>
                  <input
                    type="date"
                    className={dnStyles.dateInput}
                    value={calPeriodTo}
                    min={calPeriodFrom}
                    onChange={e => setCalPeriodTo(e.target.value)}
                  />
                </>
              )}

              {/* Period — poslije pickera, prije navigacije */}
              <button
                className={`${dnStyles.btn} ${calGranularity === 'period' ? dnStyles.active : ''}`}
                onClick={() => handleGranularityChange('period')}
              >
                Period
              </button>

              {/* Navigacija — samo za day/week/month */}
              {calGranularity !== 'period' && (
                <>
                  <button className={dnStyles.btnNav} onClick={() => handleCalShift(-1)}>‹ Nazad</button>
                  <button className={dnStyles.btnNav} onClick={goToday}>Danas</button>
                  <button className={dnStyles.btnNav} onClick={() => handleCalShift(1)}>Naprijed ›</button>
                </>
              )}
            </div>

            <div className={dnStyles.right}>
              <div className={dnStyles.searchWrap}>
                <span className={dnStyles.searchIcon}>🔍</span>
                <input
                  type="text"
                  className={dnStyles.searchInput}
                  value={calSearch}
                  onChange={e => setCalSearch(e.target.value)}
                  placeholder="Pretraži sobu..."
                />
                {calSearch && <button className={dnStyles.clearBtn} onClick={() => setCalSearch('')}>✕</button>}
              </div>
            </div>
          </div>

          {calLoading || roomsLoading ? <LoadingSpinner /> : rooms.length === 0 ? (
            <div className={styles.empty}>
              <p>Nema soba. Dodajte sobe u upravljanju sobama.</p>
              <button className={styles.btnPrimary} onClick={() => navigate('/admin/hotel/rooms')}>Upravljanje sobama</button>
            </div>
          ) : (
            <div className={styles.calendarWrap}>
              {/* Header redak — dani */}
              <div
                className={styles.calendarHeader}
                style={{ gridTemplateColumns: `100px repeat(${CAL_DAYS}, minmax(${calGranularity === 'month' ? 28 : calGranularity === 'day' ? 1 : 44}px, 1fr))` }}
              >
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
                    {calGranularity !== 'day' && (
                      <span className={styles.calendarDayName}>
                        {new Date(d).toLocaleDateString('sr-Latn', { weekday: 'short' })}
                      </span>
                    )}
                    <span className={styles.calendarDayNum}>{new Date(d).getDate()}</span>
                    {(calGranularity === 'month' || new Date(d).getDate() === 1 || d === calDates[0]) && (
                      <span className={styles.calendarMonthLabel}>
                        {new Date(d).toLocaleDateString('sr-Latn', { month: 'short' })}
                      </span>
                    )}
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
