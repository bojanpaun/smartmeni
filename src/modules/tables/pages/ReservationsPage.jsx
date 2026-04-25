// ▶ Zamijeniti: src/modules/tables/pages/ReservationsPage.jsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './ReservationsPage.module.css'

const STATUS_MAP = {
  pending:   { label: 'Na čekanju',  cls: 'statusPending' },
  confirmed: { label: 'Potvrđena',   cls: 'statusConfirmed' },
  cancelled: { label: 'Otkazana',    cls: 'statusCancelled' },
  completed: { label: 'Završena',    cls: 'statusCompleted' },
}

const today = () => new Date().toISOString().slice(0, 10)

// ── Autocomplete za ime gosta ─────────────────────────────────
function GuestAutocomplete({ value, onChange, onSelectGuest, restaurantId }) {
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const wrapRef = useRef()
  const inputRef = useRef()

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShow(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const updatePos = () => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
  }

  useEffect(() => {
    if (!value || value.length < 2) { setSuggestions([]); setShow(false); return }
    const timeout = setTimeout(async () => {
      const q = value.toLowerCase()
      const { data } = await supabase
        .from('guests')
        .select('id, first_name, last_name, phone, email, status, total_visits, total_spent')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'blacklist')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6)
      setSuggestions(data || [])
      if (data?.length > 0) { updatePos(); setShow(true) }
      else setShow(false)
    }, 250)
    return () => clearTimeout(timeout)
  }, [value, restaurantId])

  const STATUS_BADGE = {
    vip: { label: 'VIP', bg: '#FAEEDA', color: '#633806' },
    regular: null,
    pending: { label: 'Na čekanju', bg: '#E6F1FB', color: '#0C447C' },
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value) }}
        onFocus={() => { if (suggestions.length > 0) { updatePos(); setShow(true) } }}
        placeholder="Ime i prezime"
        required
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #d0e4dc', borderRadius: 9, fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
      />
      {show && suggestions.length > 0 && createPortal(
        <div style={{
          position: 'absolute',
          top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 9999,
          background: '#fff', border: '1px solid #d0e4dc', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden'
        }}>
          {suggestions.map(g => {
            const badge = STATUS_BADGE[g.status]
            return (
              <div
                key={g.id}
                onMouseDown={(e) => { e.preventDefault(); onSelectGuest(g); setShow(false) }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 10, borderBottom: '1px solid #f0f5f2',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8faf9'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#FAEEDA',
                  color: '#633806', fontSize: 12, fontWeight: 600, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {g.first_name?.[0]}{g.last_name?.[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a2e26', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {g.first_name} {g.last_name}
                    {badge && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: badge.bg, color: badge.color, fontWeight: 600 }}>{badge.label}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a9e96', marginTop: 1 }}>
                    {g.phone || g.email || '—'}
                    {g.total_visits > 0 && ` · ${g.total_visits} posjeta · €${parseFloat(g.total_spent || 0).toFixed(0)}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Kalendarski pregled ────────────────────────────────────────
function CalendarView({ reservations, onDayClick, selectedDate }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const firstDay = new Date(month.year, month.month, 1).getDay()
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1 // Pon = 0

  const prevMonth = () => setMonth(m => {
    const d = new Date(m.year, m.month - 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const nextMonth = () => setMonth(m => {
    const d = new Date(m.year, m.month + 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const monthName = new Date(month.year, month.month).toLocaleDateString('sr-Latn', { month: 'long', year: 'numeric' })

  // Grupišemo rezervacije po datumu
  const byDate = {}
  reservations.forEach(r => {
    if (r.status === 'cancelled' || r.status === 'completed') return
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })

  return (
    <div className={styles.calendar}>
      <div className={styles.calNav}>
        <button onClick={prevMonth} className={styles.calNavBtn}>‹</button>
        <span className={styles.calMonth}>{monthName}</span>
        <button onClick={nextMonth} className={styles.calNavBtn}>›</button>
      </div>

      <div className={styles.calGrid}>
        {['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'].map(d => (
          <div key={d} className={styles.calDayName}>{d}</div>
        ))}

        {Array.from({ length: adjustedFirst }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.calCellEmpty} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayRes = byDate[dateStr] || []
          const isToday = dateStr === today()
          const isSelected = dateStr === selectedDate
          const hasPending = dayRes.some(r => r.status === 'pending')

          return (
            <div
              key={day}
              className={`
                ${styles.calCell}
                ${isToday ? styles.calCellToday : ''}
                ${isSelected ? styles.calCellSelected : ''}
                ${dayRes.length > 0 ? styles.calCellHasRes : ''}
              `}
              onClick={() => onDayClick(dateStr)}
            >
              <span className={styles.calDayNum}>{day}</span>
              {dayRes.length > 0 && (
                <div className={styles.calDots}>
                  {dayRes.slice(0, 3).map((r, idx) => (
                    <span
                      key={idx}
                      className={`${styles.calDot} ${r.status === 'pending' ? styles.calDotPending : styles.calDotConfirmed}`}
                    />
                  ))}
                  {dayRes.length > 3 && <span className={styles.calDotMore}>+{dayRes.length - 3}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vizuelni picker stolova ────────────────────────────────────
function TablePicker({ tables, selectedId, reservations, date, onSelect }) {
  if (!tables.length) return (
    <div className={styles.pickerEmpty}>
      Nijesu definisani stolovi. Dodajte ih u Mapi stolova.
    </div>
  )

  const reservedIds = new Set(
    reservations
      .filter(r => r.date === date && r.status === 'confirmed' && r.table_id)
      .map(r => r.table_id)
  )

  const maxX = Math.max(...tables.map(t => t.x + t.width), 300)
  const maxY = Math.max(...tables.map(t => t.y + t.height), 200)
  const scale = Math.min(440 / (maxX + 40), 220 / (maxY + 40))

  return (
    <div className={styles.pickerWrap}>
      <div className={styles.pickerLegend}>
        <span className={styles.legendFree}>Slobodan</span>
        <span className={styles.legendReserved}>Rezervisan</span>
        <span className={styles.legendSelected}>Odabran</span>
      </div>
      <div className={styles.pickerCanvas} style={{ height: Math.round((maxY + 40) * scale) }}>
        <div className={styles.pickerGrid} />
        {tables.map(table => {
          const isReserved = reservedIds.has(table.id)
          const isSelected = selectedId === table.id
          return (
            <button
              key={table.id}
              type="button"
              className={`${styles.pickerTable} ${isSelected ? styles.pickerTableSelected : ''} ${isReserved && !isSelected ? styles.pickerTableReserved : ''}`}
              style={{
                left: Math.round(table.x * scale + 20),
                top: Math.round(table.y * scale + 20),
                width: Math.round(table.width * scale),
                height: Math.round(table.height * scale),
                borderRadius: table.shape === 'circle' ? '50%' : 8,
              }}
              onClick={() => onSelect(isSelected ? '' : table.id)}
              title={isReserved ? `${table.label || `Sto ${table.number}`} — rezervisan` : table.label || `Sto ${table.number}`}
            >
              <span className={styles.pickerTableLabel}>{table.label || `Sto ${table.number}`}</span>
              {isReserved && !isSelected && <span className={styles.pickerReservedDot}>R</span>}
            </button>
          )
        })}
      </div>
      {selectedId && (
        <div className={styles.pickerSelected}>
          Odabrano: <strong>{tables.find(t => t.id === selectedId)?.label || `Sto ${tables.find(t => t.id === selectedId)?.number}`}</strong>
          <button type="button" onClick={() => onSelect('')} className={styles.pickerClear}>✕ Ukloni</button>
        </div>
      )}
    </div>
  )
}

// ── Glavna komponenta ─────────────────────────────────────────
export default function ReservationsPage() {
  const { restaurant } = usePlatform()

  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [filterDate, setFilterDate] = useState(today())
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editRes, setEditRes] = useState(null)
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [savingToggle, setSavingToggle] = useState(false)

  const [form, setForm] = useState({
    guest_id: null, guest_name: '', guest_phone: '', guest_email: '',
    date: today(), time: '19:00', guests_count: 2,
    table_id: '', note: '', status: 'confirmed',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (restaurant) {
      loadAll()
      setOnlineEnabled(restaurant.online_reservations || false)
    }
  }, [restaurant])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: res }, { data: tbls }] = await Promise.all([
      supabase.from('reservations').select('*')
        .eq('restaurant_id', restaurant.id)
        .order('date').order('time'),
      supabase.from('tables').select('id, number, label, x, y, width, height, shape')
        .eq('restaurant_id', restaurant.id).order('number'),
    ])
    setReservations(res || [])
    setTables(tbls || [])
    setLoading(false)
  }

  const toggleOnlineReservations = async () => {
    setSavingToggle(true)
    const newVal = !onlineEnabled
    await supabase.from('restaurants').update({ online_reservations: newVal }).eq('id', restaurant.id)
    setOnlineEnabled(newVal)
    setSavingToggle(false)
  }

  const openForm = (res = null) => {
    if (res) {
      setForm({
        guest_id: res.guest_id || null, guest_name: res.guest_name, guest_phone: res.guest_phone || '',
        guest_email: res.guest_email || '', date: res.date,
        time: res.time.slice(0, 5), guests_count: res.guests_count,
        table_id: res.table_id || '', note: res.note || '', status: res.status,
      })
      setEditRes(res)
    } else {
      setForm({
        guest_id: null, guest_name: '', guest_phone: '', guest_email: '',
        date: filterDate || today(), time: '19:00', guests_count: 2,
        table_id: '', note: '', status: 'confirmed',
      })
      setEditRes(null)
    }
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditRes(null) }

  const saveReservation = async (e) => {
    e.preventDefault()
    setSaving(true)
    const selectedTable = tables.find(t => t.id === form.table_id)
    const payload = {
      restaurant_id: restaurant.id,
      guest_id: form.guest_id || null,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone || null,
      guest_email: form.guest_email || null,
      date: form.date, time: form.time,
      guests_count: form.guests_count,
      table_id: form.table_id || null,
      table_number: selectedTable?.number || null,
      note: form.note || null,
      status: form.status, source: 'admin',
    }
    if (editRes) {
      await supabase.from('reservations').update(payload).eq('id', editRes.id)
      setReservations(prev => prev.map(r => r.id === editRes.id ? { ...r, ...payload } : r))
    } else {
      const { data } = await supabase.from('reservations').insert(payload).select().single()
      setReservations(prev => [...prev, data])
    }
    setSaving(false)
    closeForm()
  }

  const updateStatus = async (id, status) => {
    await supabase.from('reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const deleteReservation = async (id) => {
    if (!confirm('Obrisati ovu rezervaciju?')) return
    await supabase.from('reservations').delete().eq('id', id)
    setReservations(prev => prev.filter(r => r.id !== id))
  }

  const filtered = reservations.filter(r => {
    const matchDate = !filterDate || r.date === filterDate
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    return matchDate && matchStatus
  })

  const pendingOnline = reservations.filter(r => r.status === 'pending' && r.source === 'online')

  if (loading) return <div className={styles.loading}>Učitavanje rezervacija...</div>

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerTitle}>Rezervacije</div>
          {pendingOnline.length > 0 && (
            <div className={styles.pendingBadge}>
              🔔 {pendingOnline.length} online {pendingOnline.length === 1 ? 'zahtjev' : 'zahtjeva'} čeka odobrenje
            </div>
          )}
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('list')}
            >☰ Lista</button>
            <button
              className={`${styles.viewBtn} ${view === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('calendar')}
            >📅 Kalendar</button>
          </div>
          <button className={styles.btnAdd} onClick={() => openForm()}>+ Nova rezervacija</button>
        </div>
      </div>

      {/* Online toggle */}
      <div className={styles.toggleCard}>
        <div className={styles.toggleInfo}>
          <div className={styles.toggleTitle}>Online rezervacije</div>
          <div className={styles.toggleDesc}>
            Kada je uključeno, gosti mogu slati zahtjeve za rezervaciju putem linka restorana.
            Svaki zahtjev morate ručno odobriti ili odbiti.
          </div>
          {onlineEnabled && (
            <div className={styles.toggleLink}>
              Javna forma: <strong>{window.location.origin}/{restaurant.slug}/rezervacija</strong>
            </div>
          )}
        </div>
        <button
          className={`${styles.toggle} ${onlineEnabled ? styles.toggleOn : styles.toggleOff}`}
          onClick={toggleOnlineReservations}
          disabled={savingToggle}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      {/* Kalendarski prikaz */}
      {view === 'calendar' && (
        <div className={styles.calendarWrap}>
          <CalendarView
            reservations={reservations}
            selectedDate={filterDate}
            onDayClick={(date) => {
              setFilterDate(date)
              setView('list')
            }}
          />
          <div className={styles.calLegend}>
            <span><span className={`${styles.calDot} ${styles.calDotConfirmed}`} /> Potvrđena</span>
            <span><span className={`${styles.calDot} ${styles.calDotPending}`} /> Na čekanju</span>
            <span className={styles.calHint}>Klikni na dan da vidiš listu</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {view === 'list' && (
        <>
          {/* Filteri */}
          <div className={styles.filters}>
            <input
              type="date"
              className={styles.filterDate}
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
            <button className={styles.filterClear} onClick={() => setFilterDate('')}>
              Svi datumi
            </button>
            <div className={styles.filterStatus}>
              {['all', 'pending', 'confirmed', 'cancelled', 'completed'].map(s => (
                <button
                  key={s}
                  className={`${styles.filterBtn} ${filterStatus === s ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'all' ? 'Sve' : STATUS_MAP[s]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista rezervacija */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📅</div>
                <div>Nema rezervacija za odabrane filtere.</div>
                <button className={styles.btnAdd} onClick={() => openForm()}>+ Dodaj rezervaciju</button>
              </div>
            ) : (
              filtered.map(res => (
                <div
                  key={res.id}
                  className={`${styles.resCard} ${res.source === 'online' && res.status === 'pending' ? styles.resCardPending : ''}`}
                >
                  <div className={styles.resMain}>
                    <div className={styles.resTop}>
                      <div className={styles.resGuest}>{res.guest_name}</div>
                      <span className={`${styles.statusPill} ${styles[STATUS_MAP[res.status]?.cls]}`}>
                        {STATUS_MAP[res.status]?.label}
                      </span>
                      {res.source === 'online' && <span className={styles.sourcePill}>Online</span>}
                    </div>
                    <div className={styles.resMeta}>
                      <span>📅 {new Date(res.date + 'T00:00:00').toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span>🕐 {res.time?.slice(0, 5)}</span>
                      <span>👥 {res.guests_count} {res.guests_count === 1 ? 'gost' : 'gosta'}</span>
                      {res.table_number && <span>🪑 Sto {res.table_number}</span>}
                      {res.guest_phone && <span>📞 {res.guest_phone}</span>}
                    </div>
                    {res.note && <div className={styles.resNote}>{res.note}</div>}
                  </div>
                  <div className={styles.resActions}>
                    {res.status === 'pending' && (
                      <>
                        <button className={styles.btnConfirm} onClick={() => updateStatus(res.id, 'confirmed')}>Potvrdi</button>
                        <button className={styles.btnCancel} onClick={() => updateStatus(res.id, 'cancelled')}>Odbij</button>
                      </>
                    )}
                    {res.status === 'confirmed' && (
                      <button className={styles.btnComplete} onClick={() => updateStatus(res.id, 'completed')}>Završi</button>
                    )}
                    <button className={styles.btnEdit} onClick={() => openForm(res)}>Uredi</button>
                    <button className={styles.btnDelete} onClick={() => deleteReservation(res.id)}>Briši</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Forma modal */}
      {showForm && (
        <div className={styles.overlay} onClick={closeForm}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editRes ? 'Uredi rezervaciju' : 'Nova rezervacija'}</div>
              <button className={styles.modalClose} onClick={closeForm}>✕</button>
            </div>

            <form onSubmit={saveReservation} className={styles.form}>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label>Ime gosta *</label>
                  <GuestAutocomplete
                    value={form.guest_name}
                    restaurantId={restaurant.id}
                    onChange={val => setForm(f => ({ ...f, guest_name: val, guest_id: null }))}
                    onSelectGuest={g => setForm(f => ({
                      ...f,
                      guest_id: g.id,
                      guest_name: `${g.first_name} ${g.last_name}`,
                      guest_phone: g.phone || f.guest_phone,
                      guest_email: g.email || f.guest_email,
                    }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Telefon</label>
                  <input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} placeholder="+382 XX XXX XXX" />
                </div>
                <div className={styles.field}>
                  <label>Email</label>
                  <input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} placeholder="gost@email.com" />
                </div>
                <div className={styles.field}>
                  <label>Broj gostiju *</label>
                  <input type="number" min="1" max="50" value={form.guests_count} onChange={e => setForm(f => ({ ...f, guests_count: parseInt(e.target.value) }))} required />
                </div>
                <div className={styles.field}>
                  <label>Datum *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>Vrijeme *</label>
                  <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">Na čekanju</option>
                    <option value="confirmed">Potvrđena</option>
                    <option value="cancelled">Otkazana</option>
                    <option value="completed">Završena</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>Napomena</label>
                  <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Posebni zahtjevi, alergije, proslava..." />
                </div>
              </div>

              {/* Vizuelni picker stolova */}
              <div className={styles.field}>
                <label>Odaberi sto na mapi</label>
                <TablePicker
                  tables={tables}
                  selectedId={form.table_id}
                  reservations={reservations}
                  date={form.date}
                  onSelect={id => setForm(f => ({ ...f, table_id: id }))}
                />
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={closeForm}>Odustani</button>
                <button type="submit" className={styles.btnSave} disabled={saving}>
                  {saving ? 'Čuvanje...' : 'Sačuvaj rezervaciju'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
