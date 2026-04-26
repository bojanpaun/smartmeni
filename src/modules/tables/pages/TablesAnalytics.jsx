// src/modules/tables/pages/TablesAnalytics.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './TableMapEditor.module.css'
import gsStyles from '../../../modules/menu/pages/GeneralSettings.module.css'

export default function TablesAnalytics() {
  const { restaurant } = usePlatform()
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', restaurant.id),
      supabase.from('reservations').select('*').eq('restaurant_id', restaurant.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('date', { ascending: false }),
    ]).then(([t, r]) => {
      setTables(t.data || [])
      setReservations(r.data || [])
      setLoading(false)
    })
  }, [restaurant])

  if (loading) return <div className={gsStyles.loading}>Učitavanje...</div>

  const totalSeats = tables.reduce((s, t) => s + (t.seats || 0), 0)
  const totalTables = tables.length
  const confirmedRes = reservations.filter(r => r.status === 'confirmed').length
  const pendingRes = reservations.filter(r => r.status === 'pending').length
  const cancelledRes = reservations.filter(r => r.status === 'cancelled').length
  const todayRes = reservations.filter(r => r.date === new Date().toISOString().slice(0, 10)).length

  const metrics = [
    { label: 'Ukupno stolova', value: totalTables, sub: null, color: null },
    { label: 'Mjesta za sjedenje', value: totalSeats, sub: 'ukupan kapacitet', color: null },
    { label: 'Rezervacije danas', value: todayRes, sub: null, color: todayRes > 0 ? '#0d7a52' : null },
    { label: 'Potvrđene (30 dana)', value: confirmedRes, sub: null, color: '#0d7a52' },
    { label: 'Na čekanju', value: pendingRes, sub: null, color: pendingRes > 0 ? '#ba7517' : null },
    { label: 'Otkazane (30 dana)', value: cancelledRes, sub: null, color: cancelledRes > 0 ? '#a32d2d' : null },
  ]

  // Raspored stolova po kapacitetu
  const byCapacity = tables.reduce((acc, t) => {
    const cap = t.seats || 0
    acc[cap] = (acc[cap] || 0) + 1
    return acc
  }, {})

  return (
    <div className={gsStyles.page} style={{ maxWidth: 900 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>Analitika stolova</h1>
        <p className={gsStyles.subtitle}>Pregled kapaciteta, rezervacija i zauzetosti za posjednjih 30 dana.</p>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 14, padding: '18px 20px',
            border: '1px solid #e0ece6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, color: '#8a9e96', fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.color || '#1a2e26', lineHeight: 1 }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 11, color: '#b0c0b8', marginTop: 4 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Raspored po kapacitetu */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0ece6', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0e1a14', marginBottom: 16 }}>Stolovi po kapacitetu</div>
        {Object.entries(byCapacity).sort(([a], [b]) => a - b).map(([cap, count]) => (
          <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 80, fontSize: 13, color: '#5a7a6a', fontWeight: 500 }}>{cap} mjesta</div>
            <div style={{ flex: 1, background: '#f0f5f2', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, background: '#0d7a52',
                width: `${(count / totalTables) * 100}%`, transition: 'width 0.6s',
              }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2e26', minWidth: 24 }}>{count}×</div>
          </div>
        ))}
        {Object.keys(byCapacity).length === 0 && (
          <div style={{ color: '#8a9e96', fontSize: 13 }}>Nema definisanih stolova.</div>
        )}
      </div>

      {/* Zadnjih 5 rezervacija */}
      {reservations.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0ece6', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0e1a14', marginBottom: 16 }}>Nedavne rezervacije</div>
          {reservations.slice(0, 8).map(r => {
            const statusColors = {
              confirmed: { bg: '#e1f5ee', color: '#0d7a52', label: 'Potvrđena' },
              pending:   { bg: '#faeeda', color: '#ba7517', label: 'Na čekanju' },
              cancelled: { bg: '#fce8e8', color: '#a32d2d', label: 'Otkazana' },
            }[r.status] || { bg: '#f0f5f2', color: '#5a7a6a', label: r.status }
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 0', borderBottom: '1px solid #f0f5f2',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2e26' }}>{r.guest_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#8a9e96' }}>
                    {r.date} · {r.time?.slice(0, 5)} · {r.guests_count} gosta
                    {r.table_number && ` · Sto ${r.table_number}`}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: statusColors.bg, color: statusColors.color }}>
                  {statusColors.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
