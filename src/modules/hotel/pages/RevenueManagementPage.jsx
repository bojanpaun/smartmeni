import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useRevenueMetrics } from '../hooks/useRevenueMetrics'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './Hotel.module.css'
import rv from './RevenueManagement.module.css'

const PERIODS = [
  { label: '7 dana',   days: 7 },
  { label: '30 dana',  days: 30 },
  { label: '90 dana',  days: 90 },
  { label: '365 dana', days: 365 },
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
    ? `prethodnih ${prevDays} dana`
    : 'prethodnog perioda'

  const handleApplySuggestion = async (sug) => {
    setApplyingDate(sug.date)
    // Upsert room_availability for this date
    const { data: rts } = await supabase
      .from('room_types')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)

    if (!rts?.length) {
      toast.error('Nema aktivnih tipova soba')
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
      toast.error('Nema aktivnih cjenovnih planova')
      setApplyingDate(null)
      return
    }

    // Upsert seasonal rate for the specific date
    const { error } = await supabase.from('seasonal_rates').upsert({
      rate_plan_id: rp[0].id,
      restaurant_id: restaurant.id,
      label: `Prijedlog cijene ${sug.date}`,
      start_date: sug.date,
      end_date: sug.date,
      price_per_night: sug.suggested,
    }, { onConflict: 'rate_plan_id,start_date,end_date' })

    setApplyingDate(null)
    if (error) return toast.error('Greška pri primjeni')
    toast.success(`Cijena za ${sug.date} postavljena na €${sug.suggested}`)
    refetch()
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Upravljanje prihodima</h1>
          <p className={styles.subtitle}>ADR · RevPAR · Popunjenost · Dinamičke cijene</p>
        </div>
        <div className={styles.headerActions}>
          <div className={rv.periodBar}>
            {PERIODS.map(p => (
              <button
                key={p.days}
                className={`${rv.periodBtn} ${periodDays === p.days ? rv.periodBtnActive : ''}`}
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={rv.loadingWrap}>
          <LoadingSpinner />
          <p className={rv.loadingMsg}>Učitavanje podataka za {periodDays} dana…</p>
          <button className={rv.btnCancel} onClick={cancel} type="button">
            Otkaži učitavanje
          </button>
        </div>
      ) : error ? (
        <div className={rv.errorWrap}>
          <div className={rv.errorIcon}>⚠️</div>
          <div className={rv.errorTitle}>
            {error === 'timeout' ? 'Prekoračeno vrijeme čekanja (15s)' : 'Greška pri učitavanju'}
          </div>
          <div className={rv.errorSub}>
            {error === 'timeout'
              ? 'Supabase nije odgovorio na vrijeme. Provjeri konekciju ili pokušaj sa kraćim periodom.'
              : 'Neočekivana greška. Pogledaj konzolu za detalje.'}
          </div>
          <button className={rv.btnRetry} onClick={refetch} type="button">
            Pokušaj ponovo
          </button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className={rv.kpiGrid}>
            <KpiCard
              label="Ukupni prihod"
              value={kpis?.totalRevenue}
              pct={kpis?.pctRevenue}
              prevLabel={prevLabel}
            />
            <KpiCard
              label="ADR (prosječna cijena/noć)"
              value={kpis?.adr}
              pct={kpis?.pctAdr}
              sub="Prosječna dnevna stopa"
              prevLabel={prevLabel}
            />
            <KpiCard
              label="RevPAR"
              value={kpis?.revpar}
              pct={kpis?.pctRevpar}
              sub={`${data?.totalRooms ?? 0} soba ukupno`}
              prevLabel={prevLabel}
            />
            <KpiCard
              label="Popunjenost"
              value={kpis?.occupancy}
              prefix=""
              pct={kpis?.pctOcc}
              sub="% zauzetosti"
              prevLabel={prevLabel}
            />
          </div>

          {/* Revenue chart */}
          <div className={rv.chartCard}>
            <div className={rv.chartTitle}>Prihod po {periodDays <= 30 ? 'danu' : 'sedmici'}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickFormatter={v => `€${v}`} width={56} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_revenue" name="Prihod" fill="var(--c-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ADR + Occupancy chart */}
          <div className={rv.chartRow}>
            <div className={rv.chartCard}>
              <div className={rv.chartTitle}>ADR trend</div>
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
              <div className={rv.chartTitle}>Rezervacije po {periodDays <= 30 ? 'danu' : 'sedmici'}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} allowDecimals={false} width={32} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="reservations_count" name="Rezervacije" fill="var(--c-primary-medium)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price Suggestions */}
          <div className={rv.sugSection}>
            <div className={rv.sugHeader}>
              <div>
                <div className={rv.sugTitle}>💡 Prijedlozi cijena — narednih 14 dana</div>
                <div className={rv.sugSub}>
                  Algoritam analizira trenutnu popunjenost i preporučuje korekcije. Primjenom se kreira sezonska stopa u aktivnom planu.
                </div>
              </div>
            </div>

            {suggestions.length === 0 ? (
              <div className={rv.sugEmpty}>
                <span>✅</span>
                <p>Nema prijedloga — cijene su optimalne za narednih 14 dana, ili nema dovoljno podataka.</p>
              </div>
            ) : (
              <div className={rv.sugTable}>
                <div className={rv.sugTableHead}>
                  <span>Datum</span>
                  <span>Popunjenost</span>
                  <span>Rezervisano</span>
                  <span>Osnovna cijena</span>
                  <span>Preporučena cijena</span>
                  <span>Razlika</span>
                  <span></span>
                </div>
                {suggestions.map(sug => {
                  const diff = sug.suggested - sug.basePrice
                  const isApplying = applyingDate === sug.date
                  return (
                    <div key={sug.date} className={rv.sugRow}>
                      <span className={rv.sugDate}>
                        {new Date(sug.date).toLocaleDateString('sr-Latn', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span>
                        <div className={rv.occBar}>
                          <div
                            className={rv.occFill}
                            style={{
                              width: `${sug.occupancy}%`,
                              background: sug.occupancy > 70 ? '#0d7a52' : sug.occupancy > 40 ? '#e67e22' : '#c0392b',
                            }}
                          />
                        </div>
                        <span className={rv.occLabel}>{sug.occupancy}%</span>
                      </span>
                      <span className={rv.sugNum}>{sug.booked} / {sug.totalRooms}</span>
                      <span className={rv.sugNum}>€{sug.basePrice}</span>
                      <span className={rv.sugPrice}>€{sug.suggested}</span>
                      <span className={`${rv.sugDiff} ${diff > 0 ? rv.sugDiffUp : rv.sugDiffDown}`}>
                        {diff > 0 ? '+' : ''}€{diff}
                      </span>
                      <button
                        className={rv.btnApply}
                        onClick={() => handleApplySuggestion(sug)}
                        disabled={!!applyingDate}
                      >
                        {isApplying ? '...' : 'Primijeni'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
