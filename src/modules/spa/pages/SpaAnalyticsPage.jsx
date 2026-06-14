import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { formatMoney, currencyMeta } from '../../../lib/currencies'
import { useSpaAnalytics } from '../hooks/useSpaAnalytics'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const PERIODS = [
  { key: 'spaPeriod7',   days: 7 },
  { key: 'spaPeriod30',  days: 30 },
  { key: 'spaPeriod90',  days: 90 },
  { key: 'spaPeriod365', days: 365 },
]

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function exportCSV(metrics, serviceStats, therapistStats, restaurantName, fromDate, toDate, t, dl, sym) {
  const lines = [
    t('spaCsvTitle'),
    `${t('spaCsvObject')}:;${restaurantName}`,
    `${t('spaCsvPeriod')}:;${fromDate} – ${toDate}`,
    `${t('spaCsvGenerated')}:;${new Date().toLocaleDateString(dl)}`,
    '',
    t('spaCsvKpiOverview'),
    `${t('spaCsvTotalRevenue')};${sym}${metrics.totalRevenue.toFixed(2)}`,
    `${t('spaCsvCompletedTreatments')};${metrics.completed}`,
    `${t('spaCsvAvgPrice')};${sym}${metrics.avgRevenue.toFixed(2)}`,
    `${t('spaCsvNoShowRate')};${metrics.noShowRate.toFixed(1)}%`,
    `${t('spaCsvHotelGuests')};${metrics.hotelGuests}`,
    `${t('spaCsvExternalGuests')};${metrics.externalGuests}`,
    '',
    t('spaCsvRevenueByTreatment'),
    t('spaCsvTreatmentHead'),
    ...serviceStats.map(s => `${s.name};${s.count};${s.revenue.toFixed(2)};${(s.revenue / s.count).toFixed(2)}`),
    '',
    t('spaCsvByTherapist'),
    t('spaCsvTherapistHead'),
    ...therapistStats.map(th => `${th.name};${th.total};${th.completed};${th.noShow};${th.revenue.toFixed(2)}`),
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
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const curSym = currencyMeta(restaurant?.currency).symbol
  const money = (a) => formatMoney(a, restaurant?.currency, i18n.language)
  const [periodDays, setPeriodDays] = useState(30)

  const toDate   = new Date().toISOString().slice(0, 10)
  const fromDate = addDays(-periodDays + 1)

  const { loading, metrics, serviceStats, therapistStats, dailyTrend } =
    useSpaAnalytics(restaurant?.id, fromDate, toDate)

  if (!restaurant) return <LoadingSpinner fullPage />

  const chartData = dailyTrend.map(d => ({
    date: new Date(d.date + 'T12:00').toLocaleDateString(dl, { day: 'numeric', month: 'short' }),
    prihod: Number(d.revenue.toFixed(2)),
    termini: d.count,
  }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('spaAnaTitle')}</h1>
          <p className={styles.subtitle}>{t('spaAnaSubtitle')}</p>
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
                {t(p.key)}
              </button>
            ))}
          </div>
          {!loading && (
            <button
              className={styles.btnSecondary}
              onClick={() => exportCSV(metrics, serviceStats, therapistStats, restaurant.name, fromDate, toDate, t, dl, curSym)}
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
              <div className={spa.kpiLabel}>{t('spaTotalRevenue')}</div>
              <div className={spa.kpiVal} style={{ color: '#0d7a52' }}>{money(metrics.totalRevenue)}</div>
              <div className={spa.kpiSub}>{t('spaCompletedTreatmentsN', { count: metrics.completed })}</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>{t('spaAvgPrice')}</div>
              <div className={spa.kpiVal}>{money(metrics.avgRevenue)}</div>
              <div className={spa.kpiSub}>{t('spaPerTreatment')}</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>{t('spaNoShowRate')}</div>
              <div className={spa.kpiVal} style={{ color: metrics.noShowRate > 15 ? '#c0392b' : '#e67e22' }}>
                {metrics.noShowRate.toFixed(1)}%
              </div>
              <div className={spa.kpiSub}>{t('spaNoShowsOfTotal', { n: metrics.noShows, total: metrics.total })}</div>
            </div>
            <div className={spa.kpiCard}>
              <div className={spa.kpiLabel}>{t('spaGuestsKpi')}</div>
              <div className={spa.kpiVal}>{metrics.hotelGuests + metrics.externalGuests}</div>
              <div className={spa.kpiSub}>🏨 {metrics.hotelGuests} {t('spaHotelShort')} · 🚶 {metrics.externalGuests} {t('spaExternalShort')}</div>
            </div>
          </div>

          {/* Daily revenue chart */}
          {chartData.length > 0 && (
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{t('spaRevenuePerDay')}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickFormatter={v => `${curSym}${v}`} width={52} />
                  <Tooltip formatter={(v, name) => name === 'prihod' ? `${curSym}${v}` : v} />
                  <Bar dataKey="prihod" name={t('spaColRevenue')} fill="#6d28d9" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            {/* Revenue by service */}
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', fontSize: 13, fontWeight: 600 }}>{t('spaRevenueByTreatment')}</div>
              {serviceStats.length === 0 ? (
                <div className={spa.empty} style={{ padding: '32px 20px' }}>{t('spaNoData')}</div>
              ) : (
                <table className={spa.table}>
                  <thead><tr><th>{t('spaTreatment')}</th><th style={{ textAlign: 'right' }}>{t('spaColNum')}</th><th style={{ textAlign: 'right' }}>{t('spaColRevenue')}</th></tr></thead>
                  <tbody>
                    {serviceStats.map(s => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--c-text-muted)' }}>{s.count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>{money(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* By therapist */}
            <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', fontSize: 13, fontWeight: 600 }}>{t('spaByTherapist')}</div>
              {therapistStats.length === 0 ? (
                <div className={spa.empty} style={{ padding: '32px 20px' }}>{t('spaNoData')}</div>
              ) : (
                <table className={spa.table}>
                  <thead><tr><th>{t('spaTherapist')}</th><th style={{ textAlign: 'right' }}>{t('spaColCompletedShort')}</th><th style={{ textAlign: 'right' }}>{t('spaColRevenue')}</th></tr></thead>
                  <tbody>
                    {therapistStats.map(th => (
                      <tr key={th.name}>
                        <td style={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{th.name}</td>
                        <td style={{ textAlign: 'right', color: 'var(--c-text-muted)' }}>{th.completed}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#6d28d9' }}>{money(th.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Status breakdown */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t('spaStatusBreakdown')}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: `✅ ${t('spaCompletedLeg')}`, val: metrics.completed, color: '#0d7a52' },
                { label: `📌 ${t('spaConfirmedLeg')}`, val: metrics.confirmed, color: '#2563eb' },
                { label: `😔 ${t('spaNoShowLeg')}`,    val: metrics.noShows,   color: '#c0392b' },
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
