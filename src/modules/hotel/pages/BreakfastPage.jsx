import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BreakfastPage() {
  const { restaurant } = usePlatform()
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState([])     // { res, persons, consumed }
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    // Rezervacije checked_in koje pokrivaju datum, na rate planu sa doručkom
    const [{ data: resList }, { data: logs }] = await Promise.all([
      supabase.from('hotel_reservations')
        .select('id, guest_name, adults, children, room_id, rooms(room_number), rate_plans(name, breakfast_included)')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'checked_in')
        .lte('check_in_date', date)
        .gt('check_out_date', date),
      supabase.from('breakfast_log')
        .select('reservation_id, persons')
        .eq('restaurant_id', restaurant.id)
        .eq('date', date),
    ])
    const logMap = new Map((logs ?? []).map(l => [l.reservation_id, l]))
    const merged = (resList ?? [])
      .filter(r => r.rate_plans?.breakfast_included)
      .map(r => ({
        res: r,
        persons: (r.adults || 0) + (r.children || 0) || 1,
        consumed: logMap.has(r.id),
        consumedPersons: logMap.get(r.id)?.persons ?? null,
      }))
      .sort((a, b) => String(a.res.rooms?.room_number || '').localeCompare(String(b.res.rooms?.room_number || ''), undefined, { numeric: true }))
    setRows(merged)
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id, date])

  const confirm = async (row) => {
    setBusyId(row.res.id)
    const { error } = await supabase.from('breakfast_log').upsert({
      restaurant_id:  restaurant.id,
      reservation_id: row.res.id,
      room_id:        row.res.room_id,
      date,
      persons:        row.persons,
    }, { onConflict: 'reservation_id,date' })
    setBusyId(null)
    if (error) return toast.error('Greška: ' + error.message)
    toast.success(`Doručak potvrđen — soba ${row.res.rooms?.room_number ?? '—'}`)
    load()
  }

  const undo = async (row) => {
    setBusyId(row.res.id)
    const { error } = await supabase.from('breakfast_log')
      .delete().eq('reservation_id', row.res.id).eq('date', date)
    setBusyId(null)
    if (error) return toast.error('Greška: ' + error.message)
    load()
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  const plannedRooms   = rows.length
  const plannedPersons = rows.reduce((s, r) => s + r.persons, 0)
  const usedRooms      = rows.filter(r => r.consumed).length
  const usedPersons    = rows.filter(r => r.consumed).reduce((s, r) => s + (r.consumedPersons ?? r.persons), 0)
  const unusedRooms    = plannedRooms - usedRooms

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Doručak — kontrola</h1>
          <p className={styles.subtitle}>Evidencija uključenih doručaka po sobi · planirano vs iskorišteno</p>
        </div>
        <input className={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 170 }} />
      </div>

      {/* Sažetak */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Planirano" value={`${plannedRooms} soba`} sub={`${plannedPersons} osoba`} />
        <Stat label="Iskorišteno" value={`${usedRooms} soba`} sub={`${usedPersons} osoba`} />
        <Stat label="Neiskorišteno" value={`${unusedRooms} soba`} sub={unusedRooms > 0 ? 'nije konzumirano' : 'sve evidentirano'} accent={unusedRooms > 0} />
      </div>

      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Nema soba sa uključenim doručkom za ovaj dan. (Uključi doručak na rate planu: Hotel → Cjenovni planovi.)
        </div>
      ) : (
        <div className={styles.table}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Soba</th>
                <th style={{ padding: '10px 12px' }}>Gost</th>
                <th style={{ padding: '10px 12px' }}>Osoba</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Akcija</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.res.id} style={{ borderTop: '1px solid var(--c-border)', opacity: row.consumed ? 0.85 : 1 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.res.rooms?.room_number ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.res.guest_name}</td>
                  <td style={{ padding: '10px 12px' }}>{row.persons}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {row.consumed
                      ? <span style={{ color: 'var(--c-primary)', fontWeight: 600 }}>✓ Konzumiran</span>
                      : <span style={{ color: 'var(--c-text-muted)' }}>— Nije</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {row.consumed
                      ? <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => undo(row)} disabled={busyId === row.res.id}>Poništi</button>
                      : <button className={styles.btnPrimary} style={{ fontSize: 12 }} onClick={() => confirm(row)} disabled={busyId === row.res.id}>{busyId === row.res.id ? '...' : '✓ Potvrdi'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ padding: 12, border: `1px solid ${accent ? '#fca5a5' : 'var(--c-border)'}`, borderRadius: 10, background: accent ? '#fef2f2' : 'transparent' }}>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: accent ? '#c0392b' : 'inherit' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
