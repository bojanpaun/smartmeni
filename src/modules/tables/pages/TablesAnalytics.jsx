// src/modules/tables/pages/TablesAnalytics.jsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './TableMapEditor.module.css'
import gsStyles from '../../../modules/menu/pages/GeneralSettings.module.css'

export default function TablesAnalytics() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurant) return
    Promise.all([
      // Metrika nad AKTIVNIM layoutom (ne miješa stolove draft/event rasporeda).
      supabase.from('tables').select('*, table_layouts!inner(is_active)')
        .eq('restaurant_id', restaurant.id).eq('table_layouts.is_active', true),
      supabase.from('reservations').select('*').eq('restaurant_id', restaurant.id)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('date', { ascending: false }),
    ]).then(([t, r]) => {
      setTables(t.data || [])
      setReservations(r.data || [])
      setLoading(false)
    })
  }, [restaurant])

  if (loading) return <div className={gsStyles.loading}>{t('loading')}</div>

  const totalSeats = tables.reduce((s, tb) => s + (tb.seats || 0), 0)
  const totalTables = tables.length
  const confirmedRes = reservations.filter(r => r.status === 'confirmed').length
  const pendingRes = reservations.filter(r => r.status === 'pending').length
  const cancelledRes = reservations.filter(r => r.status === 'cancelled').length
  const todayRes = reservations.filter(r => r.date === new Date().toISOString().slice(0, 10)).length

  const metrics = [
    { label: t('tanTotalTables'), value: totalTables, sub: null, color: null },
    { label: t('tanSeats'), value: totalSeats, sub: t('tanTotalCapacity'), color: null },
    { label: t('tanResToday'), value: todayRes, sub: null, color: todayRes > 0 ? 'var(--c-primary)' : null },
    { label: t('tanConfirmed30'), value: confirmedRes, sub: null, color: 'var(--c-primary)' },
    { label: t('tanPending'), value: pendingRes, sub: null, color: pendingRes > 0 ? 'var(--c-warning)' : null },
    { label: t('tanCancelled30'), value: cancelledRes, sub: null, color: cancelledRes > 0 ? 'var(--c-danger)' : null },
  ]

  // Raspored stolova po kapacitetu
  const byCapacity = tables.reduce((acc, tb) => {
    const cap = tb.seats || 0
    acc[cap] = (acc[cap] || 0) + 1
    return acc
  }, {})

  return (
    <div className={gsStyles.page} style={{ maxWidth: 900 }}>
      <div className={gsStyles.header}>
        <h1 className={gsStyles.title}>{t('tanTitle')}</h1>
        <p className={gsStyles.subtitle}>{t('tanSubtitle')}</p>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: 'var(--c-surface)', borderRadius: 14, padding: '18px 20px',
            border: '1px solid var(--c-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: m.color || 'var(--c-text)', lineHeight: 1 }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Raspored po kapacitetu */}
      <div style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 16 }}>{t('tanByCapacity')}</div>
        {Object.entries(byCapacity).sort(([a], [b]) => a - b).map(([cap, count]) => (
          <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 80, fontSize: 13, color: 'var(--c-text-medium)', fontWeight: 500 }}>{cap} {t('tblSeats')}</div>
            <div style={{ flex: 1, background: 'var(--c-bg-subtle)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, background: 'var(--c-primary)',
                width: `${(count / totalTables) * 100}%`, transition: 'width 0.6s',
              }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', minWidth: 24 }}>{count}×</div>
          </div>
        ))}
        {Object.keys(byCapacity).length === 0 && (
          <div style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>{t('tanNoTables')}</div>
        )}
      </div>

      {/* Zadnjih 5 rezervacija */}
      {reservations.length > 0 && (
        <div style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', marginBottom: 16 }}>{t('tanRecentRes')}</div>
          {reservations.slice(0, 8).map(r => {
            const statusColors = {
              confirmed: { bg: 'var(--c-primary-light)', color: 'var(--c-primary)', label: t('tblStConfirmed') },
              pending:   { bg: 'var(--c-warning-bg)', color: 'var(--c-warning)', label: t('tblStPending') },
              cancelled: { bg: 'var(--c-danger-bg)', color: 'var(--c-danger)', label: t('tblStCancelled') },
            }[r.status] || { bg: 'var(--c-bg-subtle)', color: 'var(--c-text-medium)', label: r.status }
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 0', borderBottom: '1px solid var(--c-border)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{r.guest_name || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                    {r.date} · {r.time?.slice(0, 5)} · {r.guests_count} {t('tblGuestOther')}
                    {r.table_number && ` · ${t('anaTable')} ${r.table_number}`}
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
