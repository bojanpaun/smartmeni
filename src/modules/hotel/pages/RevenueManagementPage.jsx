import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { useRevenueMetrics } from '../hooks/useRevenueMetrics'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import styles from './Hotel.module.css'
import rv from './RevenueManagement.module.css'

// ── Export helpers ────────────────────────────────────────────

function exportCSV(data, kpis, periodDays, restaurantName, t, dl) {
  const today = new Date().toLocaleDateString(dl)
  const pct = (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : 'N/A'
  const eur = (v) => '€' + Number(v || 0).toFixed(2)

  const lines = [
    `RestByMe — ${t('rvAnalyticsTitle')}`,
    `${t('rvObject')}:;${restaurantName}`,
    `${t('rvPeriod')}:;${t('rvLastDays', { n: periodDays })}`,
    `${t('rvGenerated')}:;${today}`,
    '',
    t('rvKpiOverview'),
    `${t('rvMetric')};${t('rvValue')};${t('rvChangeVsPrev')}`,
    `${t('rvTotalRevenue')};${eur(kpis.totalRevenue)};${pct(kpis.pctRevenue)}`,
    `${t('rvAdrFull')};${eur(kpis.adr)};${pct(kpis.pctAdr)}`,
    `RevPAR;${eur(kpis.revpar)};${pct(kpis.pctRevpar)}`,
    `${t('kpiOccupancy')};${Number(kpis.occupancy || 0).toFixed(1)}%;${pct(kpis.pctOcc)}`,
    '',
    t('rvDailyData'),
    `${t('htDateHead')};${t('rvRevenueEur')};${t('rvAdrEur')};${t('rvReservations')};${t('rvNights')}`,
    ...(data.daily || []).map(d =>
      `${d.date};${Number(d.total_revenue).toFixed(2)};${Number(d.adr).toFixed(2)};${d.reservations_count};${d.room_nights_sold}`
    ),
  ]

  const csv = lines.join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `revenue-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function printRevenuePDF(data, kpis, periodDays, restaurantName, suggestions, t, dl) {
  const today = new Date().toLocaleDateString(dl)
  const eur = (v) => '€' + Number(v || 0).toFixed(2)
  const pctStr = (v) => v != null ? `<span style="color:${v >= 0 ? '#0d7a52' : '#c0392b'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%</span>` : '—'

  const dailyRows = (data.daily || []).map(d => `
    <tr>
      <td>${d.date}</td>
      <td>€${Number(d.total_revenue).toFixed(2)}</td>
      <td>€${Number(d.adr).toFixed(2)}</td>
      <td>${d.reservations_count}</td>
      <td>${d.room_nights_sold}</td>
    </tr>`).join('')

  const sugRows = suggestions.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#6b7280">${t('rvNoSuggestionsShort')}</td></tr>`
    : suggestions.map(s => `
      <tr>
        <td>${s.date}</td>
        <td>${s.occupancy}%</td>
        <td>${s.booked} / ${s.totalRooms}</td>
        <td>€${s.basePrice}</td>
        <td><strong>€${s.suggested}</strong></td>
      </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="bs">
<head>
  <meta charset="UTF-8">
  <title>${t('rvAnalyticsTitle')} — ${restaurantName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px 40px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #6b7280; margin-bottom: 28px; }
    h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 4px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    .kpi-val { font-size: 22px; font-weight: 700; }
    .kpi-pct { font-size: 11px; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f9fafb; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #6b7280; padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 16px 20px; } }
  </style>
</head>
<body>
  <h1>${t('rvAnalyticsTitle')} — ${restaurantName}</h1>
  <p class="sub">${t('rvPeriod')}: ${t('rvLastDays', { n: periodDays })} &nbsp;·&nbsp; ${t('rvGenerated')}: ${today}</p>

  <h2>${t('rvKpiOverview')}</h2>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">${t('rvTotalRevenue')}</div><div class="kpi-val">${eur(kpis.totalRevenue)}</div><div class="kpi-pct">${pctStr(kpis.pctRevenue)}</div></div>
    <div class="kpi"><div class="kpi-label">ADR</div><div class="kpi-val">${eur(kpis.adr)}</div><div class="kpi-pct">${pctStr(kpis.pctAdr)}</div></div>
    <div class="kpi"><div class="kpi-label">RevPAR</div><div class="kpi-val">${eur(kpis.revpar)}</div><div class="kpi-pct">${pctStr(kpis.pctRevpar)}</div></div>
    <div class="kpi"><div class="kpi-label">${t('kpiOccupancy')}</div><div class="kpi-val">${Number(kpis.occupancy || 0).toFixed(1)}%</div><div class="kpi-pct">${pctStr(kpis.pctOcc)}</div></div>
  </div>

  <h2>${t('rvDailyData')}</h2>
  <table>
    <thead><tr><th>${t('htDateHead')}</th><th>${t('rvRevenue')}</th><th>ADR</th><th>${t('rvReservations')}</th><th>${t('rvNights')}</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>

  <h2>${t('rvSuggestionsTitle')}</h2>
  <table>
    <thead><tr><th>${t('htDateHead')}</th><th>${t('kpiOccupancy')}</th><th>${t('rvBooked')}</th><th>${t('rvBasePrice')}</th><th>${t('rvSuggested')}</th></tr></thead>
    <tbody>${sugRows}</tbody>
  </table>

  <div class="footer">Powered by RestByMe</div>
  <script>window.onload = () => { window.print() }<\/script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { toast.error(t('rvAllowPopups')); return }
  win.document.write(html)
  win.document.close()
}

const PERIODS = [
  { days: 7 },
  { days: 30 },
  { days: 90 },
  { days: 365 },
]

function fmt(n) { return Number(n || 0).toFixed(2) }
function fmtPct(n) {
  if (n === null || n === undefined) return null
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function KpiCard({ label, value, prefix = '€', pct, sub, prevLabel }) {
  const up = pct > 0
  const down = pct < 0
  return (
    <div className={rv.kpiCard}>
      <div className={rv.kpiLabel}>{label}</div>
      <div className={rv.kpiVal}>{prefix}{fmt(value)}</div>
      {pct !== null && pct !== undefined && (
        <div className={`${rv.kpiPct} ${up ? rv.kpiUp : down ? rv.kpiDown : ''}`}>
          {up ? '▲' : down ? '▼' : '—'} {Math.abs(pct).toFixed(1)}% vs {prevLabel}
        </div>
      )}
      {sub && <div className={rv.kpiSub}>{sub}</div>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className={rv.tooltip}>
      <div className={rv.tooltipLabel}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'occupancy' ? p.value + '%' : '€' + fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

function formatDateAxis(str) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

function formatWeekAxis(str) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

// Aggregate daily data into weekly buckets for longer periods
function aggregateWeekly(daily) {
  const weeks = {}
  for (const d of daily) {
    const dt = new Date(d.date)
    const dayOfWeek = dt.getDay()
    const monday = new Date(dt)
    monday.setDate(dt.getDate() - ((dayOfWeek + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    if (!weeks[key]) weeks[key] = { date: key, total_revenue: 0, adr_sum: 0, adr_count: 0, room_nights_sold: 0, reservations_count: 0 }
    weeks[key].total_revenue    += d.total_revenue
    weeks[key].room_nights_sold += d.room_nights_sold
    weeks[key].reservations_count += d.reservations_count
    if (d.adr > 0) { weeks[key].adr_sum += d.adr; weeks[key].adr_count++ }
  }
  return Object.values(weeks).map(w => ({
    ...w,
    adr: w.adr_count > 0 ? w.adr_sum / w.adr_count : 0,
  })).sort((a, b) => a.date.localeCompare(b.date))
}

export default function RevenueManagementPage() {
  const { restaurant } = usePlatform()
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const [periodDays, setPeriodDays] = useState(30)
  const [applyingDate, setApplyingDate] = useState(null)
  const { data, suggestions, loading, error, refetch, cancel } = useRevenueMetrics(restaurant?.id, periodDays)

  if (!restaurant) return <LoadingSpinner fullPage />

  const chartData = periodDays <= 30
    ? (data?.daily ?? []).map(d => ({ ...d, date: formatDateAxis(d.date) }))
    : aggregateWeekly(data?.daily ?? []).map(d => ({ ...d, date: formatWeekAxis(d.date) }))

  const kpis = data?.kpis
  const prevDays = data?.prevDays ?? periodDays
  const prevLabel = prevDays < periodDays
    ? t('rvPrevDays', { n: prevDays })
    : t('rvPrevPeriod')

  const handleApplySuggestion = async (sug) => {
    setApplyingDate(sug.date)
    // Upsert room_availability for this date
    const { data: rts } = await supabase
      .from('room_types')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)

    if (!rts?.length) {
      toast.error(t('rvNoActiveRoomTypes'))
      setApplyingDate(null)
      return
    }

    // Update seasonal rate or create rate adjustment
    // For simplicity: update first rate plan's price_per_night
    const { data: rp } = await supabase
      .from('rate_plans')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order')
      .limit(1)

    if (!rp?.length) {
      toast.error(t('rvNoActiveRatePlans'))
      setApplyingDate(null)
      return
    }

    // Upsert seasonal rate for the specific date
    const { error } = await supabase.from('seasonal_rates').upsert({
      rate_plan_id: rp[0].id,
      restaurant_id: restaurant.id,
      label: t('rvSuggestionLabel', { date: sug.date }),
      start_date: sug.date,
      end_date: sug.date,
      price_per_night: sug.suggested,
    }, { onConflict: 'rate_plan_id,start_date,end_date' })

    setApplyingDate(null)
    if (error) return toast.error(t('rvApplyErr'))
    toast.success(t('rvPriceSetMsg', { date: sug.date, price: sug.suggested }))
    refetch()
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('rvTitle')}</h1>
          <p className={styles.subtitle}>{t('rvSubtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={rv.periodBar}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                className={`${rv.periodBtn} ${periodDays === p.days ? rv.periodBtnActive : ''}`}
                onClick={() => setPeriodDays(p.days)}
              >
                {t('rvDaysN', { n: p.days })}
              </button>
            ))}
          </div>
          {!loading && !error && data && (
            <div className={rv.exportBar}>
              <button
                className={rv.btnExport}
                onClick={() => exportCSV(data, data.kpis, periodDays, restaurant.name, t, dl)}
                title={t('rvCsvTitle2')}
              >
                ⬇ CSV
              </button>
              <button
                className={rv.btnExport}
                onClick={() => printRevenuePDF(data, data.kpis, periodDays, restaurant.name, suggestions, t, dl)}
                title={t('rvPdfTitle')}
              >
                🖨 PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className={rv.loadingWrap}>
          <LoadingSpinner />
          <p className={rv.loadingMsg}>{t('rvLoadingData', { n: periodDays })}</p>
          <button className={rv.btnCancel} onClick={cancel} type="button">
            {t('rvCancelLoading')}
          </button>
        </div>
      ) : error ? (
        <div className={rv.errorWrap}>
          <div className={rv.errorIcon}>⚠️</div>
          <div className={rv.errorTitle}>
            {error === 'timeout' ? t('rvTimeout') : t('rvLoadError')}
          </div>
          <div className={rv.errorSub}>
            {error === 'timeout' ? t('rvTimeoutSub') : t('rvUnexpectedErr')}
          </div>
          <button className={rv.btnRetry} onClick={refetch} type="button">
            {t('rvRetry')}
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className={rv.kpiGrid}>
            <KpiCard
              label={t('rvTotalRevenue')}
              value={kpis?.totalRevenue}
              pct={kpis?.pctRevenue}
              prevLabel={prevLabel}
            />
            <KpiCard
              label={t('rvAdrFull')}
              value={kpis?.adr}
              pct={kpis?.pctAdr}
              sub={t('rvAdrSubCard')}
              prevLabel={prevLabel}
            />
            <KpiCard
              label="RevPAR"
              value={kpis?.revpar}
              pct={kpis?.pctRevpar}
              sub={t('htRoomsTotal', { n: data?.totalRooms ?? 0 })}
              prevLabel={prevLabel}
            />
            <KpiCard
              label={t('kpiOccupancy')}
              value={kpis?.occupancy}
              prefix=""
              pct={kpis?.pctOcc}
              sub={t('rvOccSub')}
              prevLabel={prevLabel}
            />
          </div>

          {/* Revenue chart */}
          <div className={rv.chartCard}>
            <div className={rv.chartTitle}>{t('rvRevenuePer', { unit: periodDays <= 30 ? t('rvUnitDay') : t('rvUnitWeek') })}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickFormatter={v => `€${v}`} width={56} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" name={t('rvRevenue')} fill="var(--c-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ADR + Occupancy chart */}
          <div className={rv.chartRow}>
            <div className={rv.chartCard}>
              <div className={rv.chartTitle}>{t('rvAdrTrend')}</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickFormatter={v => `€${v}`} width={52} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone" dataKey="adr" name="ADR"
                    stroke="#2563eb" strokeWidth={2} dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={rv.chartCard}>
              <div className={rv.chartTitle}>{t('rvReservationsPer', { unit: periodDays <= 30 ? t('rvUnitDay') : t('rvUnitWeek') })}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} allowDecimals={false} width={32} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="reservations_count" name={t('rvReservations')} fill="var(--c-primary-medium)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price Suggestions */}
          <div className={rv.sugSection}>
            <div className={rv.sugHeader}>
              <div>
                <div className={rv.sugTitle}>💡 {t('rvSuggestionsTitle')}</div>
                <div className={rv.sugSub}>
                  {t('rvSuggestionsSub')}
                </div>
              </div>
            </div>

            {suggestions.length === 0 ? (
              <div className={rv.sugEmpty}>
                <span>✅</span>
                <p>{t('rvNoSuggestions')}</p>
              </div>
            ) : (<>
              {/* Desktop */}
              <div className={rv.sugDesktopTable}>
                <div className={rv.sugTable}>
                  <div className={rv.sugTableHead}>
                    <span>{t('htDateHead')}</span>
                    <span>{t('kpiOccupancy')}</span>
                    <span>{t('rvBooked')}</span>
                    <span>{t('rvBasePrice')}</span>
                    <span>{t('rvSuggestedPrice')}</span>
                    <span>{t('rvDiff')}</span>
                    <span></span>
                  </div>
                  {suggestions.map(sug => {
                    const diff = sug.suggested - sug.basePrice
                    const isApplying = applyingDate === sug.date
                    return (
                      <div key={sug.date} className={rv.sugRow}>
                        <span className={rv.sugDate}>{new Date(sug.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span>
                          <div className={rv.occBar}><div className={rv.occFill} style={{ width: `${sug.occupancy}%`, background: sug.occupancy > 70 ? '#0d7a52' : sug.occupancy > 40 ? '#e67e22' : '#c0392b' }} /></div>
                          <span className={rv.occLabel}>{sug.occupancy}%</span>
                        </span>
                        <span className={rv.sugNum}>{sug.booked} / {sug.totalRooms}</span>
                        <span className={rv.sugNum}>€{sug.basePrice}</span>
                        <span className={rv.sugPrice}>€{sug.suggested}</span>
                        <span className={`${rv.sugDiff} ${diff > 0 ? rv.sugDiffUp : rv.sugDiffDown}`}>{diff > 0 ? '+' : ''}€{diff}</span>
                        <button className={rv.btnApply} onClick={() => handleApplySuggestion(sug)} disabled={!!applyingDate}>{isApplying ? '...' : t('rvApply')}</button>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Mobile */}
              <div className={rv.sugMobileList}>
                {suggestions.map(sug => {
                  const diff = sug.suggested - sug.basePrice
                  const isApplying = applyingDate === sug.date
                  const occColor = sug.occupancy > 70 ? '#0d7a52' : sug.occupancy > 40 ? '#e67e22' : '#c0392b'
                  return (
                    <div key={sug.date} className={rv.sugCard}>
                      <div className={rv.sugCardTop}>
                        <div className={rv.sugCardDate}>{new Date(sug.date).toLocaleDateString(dl, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                        <span className={`${rv.sugCardDiff} ${diff > 0 ? rv.sugDiffUp : rv.sugDiffDown}`}>{diff > 0 ? '+' : ''}€{diff}</span>
                      </div>
                      <div>
                        <div className={rv.occBar}><div className={rv.occFill} style={{ width: `${sug.occupancy}%`, background: occColor }} /></div>
                        <span className={rv.occLabel} style={{ color: occColor }}>{t('rvOccBooked', { occ: sug.occupancy, booked: sug.booked, total: sug.totalRooms })}</span>
                      </div>
                      <div className={rv.sugCardPrices}>
                        <div><div className={rv.sugCardPriceLabel}>{t('rvBasePrice')}</div><div className={rv.sugCardPriceVal}>€{sug.basePrice}</div></div>
                        <div><div className={rv.sugCardPriceLabel}>{t('rvSuggested')}</div><div className={`${rv.sugCardPriceVal} ${rv.sugCardPriceValHigh}`}>€{sug.suggested}</div></div>
                        <div><div className={rv.sugCardPriceLabel}>{t('rvBooked')}</div><div className={rv.sugCardPriceVal}>{sug.booked}/{sug.totalRooms}</div></div>
                      </div>
                      <button className={rv.btnApply} style={{ width: '100%' }} onClick={() => handleApplySuggestion(sug)} disabled={!!applyingDate}>{isApplying ? '...' : t('rvApplyPrice')}</button>
                    </div>
                  )
                })}
              </div>
            </>)}
          </div>
        </>
      )}
    </div>
  )
}
