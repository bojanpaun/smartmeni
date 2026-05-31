import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useSpaAnalytics } from '../hooks/useSpaAnalytics'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const PERIODS = [
  { label: '7 dana',   days: 7 },
  { label: '30 dana',  days: 30 },
  { label: '90 dana',  days: 90 },
  { label: '365 dana', days: 365 },
]

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function exportCSV(metrics, serviceStats, therapistStats, restaurantName, fromDate, toDate) {
  const lines = [
    'SmartMeni — Spa & Wellness analitika',
    `Objekat:;${restaurantName}`,
    `Period:;${fromDate} – ${toDate}`,
    `Generisano:;${new Date().toLocaleDateString('sr-Latn')}`,
    '',
    'KPI PREGLED',
    `Ukupni prihod;€${metrics.totalRevenue.toFixed(2)}`,
    `Završenih tretmana;${metrics.completed}`,
    `Prosječna cijena tretmana;€${metrics.avgRevenue.toFixed(2)}`,
    `No-show stopa;${metrics.noShowRate.toFixed(1)}%`,
    `Hotelski gosti;${metrics.hotelGuests}`,
    `Vanjski gosti;${metrics.externalGuests}`,
    '',
    'PRIHOD PO TRETMANU',
    'Tretman;Završeno;Prihod (€);Prosječna cijena (€)',
    ...serviceStats.map(s => `${s.name};${s.count};${s.revenue.toFixed(2)};${(s.revenue / s.count).toFixed(2)}`),
    '',
    'PO TERAPEUTU',
    'Terapeut;Ukupno;Završeno;No-show;Prihod (€)',
    ...therapistStats.map(t => `${t.name};${t.total};${t.completed};${t.noShow};${t.revenue.toFixed(2)}`),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spa-analytics-${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function SpaAnalyticsPage() {
  const { restaurant } = usePlatform()
  const [periodDays, setPeriodDays] = useState(30)

  const toDate   = new Date().toISOString().slice(0, 10)
  const fromDate = addDays(-periodDays + 1)

  const { loading, metrics, serviceStats, therapistStats, dailyTrend } =
    useSpaAnalytics(restaurant?.id, fromDate, toDate)

  if (!restaurant) return <LoadingSpinner fullPage />

  const chartData = dailyTrend.map(d => ({
    date: new Date(d.date + 'T12:00').toLocaleDateString('sr-Latn', { day: 'numeric', month: 'short' }),
    prihod: Number(d.revenue.toFixed(2)),
    termini: d.count,
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Spa analitika</h1>
          <p className={styles.subtitle}>Prihod, utilization i performanse po tretmanima</p>
        </div>
        <div className={styles.headerActions}>
          <div style={{ display: 'flex', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriodDays(p.days)}
                style={{
                  padding: '7px 14px', border: 'none', fontSize: 13,
                  background: periodDays === p.days ? 'var(--c-primary)' : 'transparent',
                  color: periodDays === p.days ? '#fff' : 'var(--c-text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {!loading && (
            <button
              className={styles.btnSecondary}
              onClick={() => exportCSV(metrics, serviceStats, therapistStats, restaurant.name, fromDate, toDate)}
            >
              ⬇ CSV
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* KPI cards */}
          <div className={spa.kpiGrid}>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>Ukupni prihod</div>
              <div className={spa.kpiVal} style={{ color: '#0d7a52' }}>€{metrics.totalRevenue.toFixed(2)}</div>
              <div className={spa.kpiSub}>{metrics.completed} završenih tretmana</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>Prosječna cijena</div>
              <div className={spa.kpiVal}>€{metrics.avgRevenue.toFixed(2)}</div>
              <div className={spa.kpiSub}>po tretmanu</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>No-show stopa</div>
              <div className={spa.kpiVal} style={{ color: metrics.noShowRate > 15 ? '#c0392b' : '#e67e22' }}>
                {metrics.noShowRate.toFixed(1)}%
              </div>
              <div className={spa.kpiSub}>{metrics.noShows} od {metrics.total} termina</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>Gosti</div>
              <div className={spa.kpiVal}>{metrics.hotelGuests + metrics.externalGuests}</div>
              <div className={spa.kpiSub}>🏨 {metrics.hotelGuests} hotel · 🚶 {metrics.externalGuests} vanjski</div>
            </div>
          </div>

          {/* Daily revenue chart */}
          {chartData.length > 0 && (
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Prihod po danu</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickFormatter={v => `€${v}`} width={52} />
                  <Tooltip formatter={(v, name) => name === 'prihod' ? `€${v}` : v} />
                  <Bar dataKey="prihod" name="Prihod" fill="#6d28d9" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Revenue by service */}
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', fontSize: 13, fontWeight: 600 }}>Prihod po tretmanu</div>
              {serviceStats.length === 0 ? (
                <div className={spa.empty} style={{ padding: '32px 20px' }}>Nema podataka</div>
              ) : (
                <table className={spa.table}>
                  <thead><tr><th>Tretman</th><th style={{ textAlign: 'right' }}>Br.</th><th style={{ textAlign: 'right' }}>Prihod</th></tr></thead>
                  <tbody>
                    {serviceStats.map(s => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--c-text-muted)' }}>{s.count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>€{s.revenue.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* By therapist */}
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', fontSize: 13, fontWeight: 600 }}>Po terapeutu</div>
              {therapistStats.length === 0 ? (
                <div className={spa.empty} style={{ padding: '32px 20px' }}>Nema podataka</div>
              ) : (
                <table className={spa.table}>
                  <thead><tr><th>Terapeut</th><th style={{ textAlign: 'right' }}>Završ.</th><th style={{ textAlign: 'right' }}>Prihod</th></tr></thead>
                  <tbody>
                    {therapistStats.map(t => (
                      <tr key={t.name}>
                        <td style={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--c-text-muted)' }}>{t.completed}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>€{t.revenue.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Status breakdown */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Raspodjela po statusu</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: '✅ Završeni',   val: metrics.completed, color: '#0d7a52' },
                { label: '📌 Potvrđeni', val: metrics.confirmed, color: '#2563eb' },
                { label: '😔 No-show',   val: metrics.noShows,   color: '#c0392b' },
              ].map(item => (
                <div key={item.label} style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '14px', background: 'var(--c-bg)', borderRadius: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.val}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
